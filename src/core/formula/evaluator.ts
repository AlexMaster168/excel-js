import {expandRange, refToId} from '@core/formula/cellRef'
import {FUNCTIONS} from '@core/formula/functions'
import {
  FormulaError,
  compareValues,
  errToString,
  formatValue,
  toBoolean,
  toNumber,
  toText
} from '@core/formula/values'
import type {FormulaValue} from '@core/formula/values'

/** Источник сырых значений ячеек по id "row:col". */
export interface FormulaContext {
  getRaw(id: string): string | undefined
}

// --- Токенайзер ---

type TokenType =
  | 'NUMBER' | 'STRING' | 'NAME' | 'OP'
  | 'LPAREN' | 'RPAREN' | 'ARGSEP' | 'COLON'

interface Token {
  type: TokenType
  value: string
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++
      continue
    }
    if (ch >= '0' && ch <= '9' || ch === '.') {
      let num = ''
      while (i < input.length && (input[i] >= '0' && input[i] <= '9' || input[i] === '.')) {
        num += input[i]
        i++
      }
      tokens.push({type: 'NUMBER', value: num})
      continue
    }
    if (input.startsWith('#REF!', i)) {
      throw new FormulaError('REF', 'Reference was deleted')
    }
    if (ch === '"') {
      i++
      let s = ''
      while (i < input.length && input[i] !== '"') {
        s += input[i]
        i++
      }
      if (i >= input.length) {
        throw new FormulaError('ERROR', 'Unterminated string')
      }
      i++ // закрывающая "
      tokens.push({type: 'STRING', value: s})
      continue
    }
    if (/[A-Za-zА-Яа-я_$]/.test(ch)) {
      let name = ''
      while (i < input.length && /[A-Za-zА-Яа-я0-9_.$]/.test(input[i])) {
        name += input[i]
        i++
      }
      tokens.push({type: 'NAME', value: name})
      continue
    }
    if (ch === '(') {
      tokens.push({type: 'LPAREN', value: ch}); i++; continue
    }
    if (ch === ')') {
      tokens.push({type: 'RPAREN', value: ch}); i++; continue
    }
    if (ch === ',' || ch === ';') {
      tokens.push({type: 'ARGSEP', value: ch}); i++; continue
    }
    if (ch === ':') {
      tokens.push({type: 'COLON', value: ch}); i++; continue
    }
    // двусимвольные операторы сравнения
    if (ch === '<' && input[i + 1] === '=') {
      tokens.push({type: 'OP', value: '<='}); i += 2; continue
    }
    if (ch === '<' && input[i + 1] === '>') {
      tokens.push({type: 'OP', value: '<>'}); i += 2; continue
    }
    if (ch === '>' && input[i + 1] === '=') {
      tokens.push({type: 'OP', value: '>='}); i += 2; continue
    }
    if ('+-*/^%&=<>'.includes(ch)) {
      tokens.push({type: 'OP', value: ch}); i++; continue
    }
    throw new FormulaError('ERROR', `Unexpected character: ${ch}`)
  }
  return tokens
}

// --- Парсер (рекурсивный спуск) с приоритетами Excel ---

class Parser {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly ctx: FormulaContext,
    private readonly visiting: Set<string>
  ) {}

  parse(): FormulaValue {
    const value = this.comparison()
    if (this.pos < this.tokens.length) {
      throw new FormulaError('ERROR', 'Unexpected trailing tokens')
    }
    return value
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private at(offset: number): Token | undefined {
    return this.tokens[this.pos + offset]
  }

  private isOp(...ops: string[]): boolean {
    const t = this.peek()
    return !!t && t.type === 'OP' && ops.includes(t.value)
  }

  // сравнения (=, <>, <, >, <=, >=) — низший приоритет, результат boolean
  private comparison(): FormulaValue {
    let left = this.concat()
    while (this.isOp('=', '<>', '<', '>', '<=', '>=')) {
      const op = this.tokens[this.pos++].value
      const right = this.concat()
      const c = compareValues(left, right)
      switch (op) {
        case '=': left = c === 0; break
        case '<>': left = c !== 0; break
        case '<': left = c < 0; break
        case '>': left = c > 0; break
        case '<=': left = c <= 0; break
        case '>=': left = c >= 0; break
      }
    }
    return left
  }

  // конкатенация &
  private concat(): FormulaValue {
    let left = this.additive()
    while (this.isOp('&')) {
      this.pos++
      const right = this.additive()
      left = toText(left) + toText(right)
    }
    return left
  }

  private additive(): FormulaValue {
    let left = this.multiplicative()
    while (this.isOp('+', '-')) {
      const op = this.tokens[this.pos++].value
      const right = this.multiplicative()
      left = op === '+' ? toNumber(left) + toNumber(right) : toNumber(left) - toNumber(right)
    }
    return left
  }

  private multiplicative(): FormulaValue {
    let left = this.power()
    while (this.isOp('*', '/')) {
      const op = this.tokens[this.pos++].value
      const right = this.power()
      if (op === '*') {
        left = toNumber(left) * toNumber(right)
      } else {
        const d = toNumber(right)
        if (d === 0) {
          throw new FormulaError('DIV/0', 'Division by zero')
        }
        left = toNumber(left) / d
      }
    }
    return left
  }

  // степень ^ (право-ассоциативно)
  private power(): FormulaValue {
    const left = this.unary()
    if (this.isOp('^')) {
      this.pos++
      const right = this.power()
      return Math.pow(toNumber(left), toNumber(right))
    }
    return left
  }

  private unary(): FormulaValue {
    if (this.isOp('-')) {
      this.pos++
      return -toNumber(this.unary())
    }
    if (this.isOp('+')) {
      this.pos++
      return this.unary()
    }
    return this.postfix()
  }

  // постфиксный процент: 50% -> 0.5
  private postfix(): FormulaValue {
    let value = this.primary()
    while (this.isOp('%')) {
      this.pos++
      value = toNumber(value) / 100
    }
    return value
  }

  private primary(): FormulaValue {
    const t = this.peek()
    if (!t) {
      throw new FormulaError('ERROR', 'Unexpected end of formula')
    }
    if (t.type === 'NUMBER') {
      this.pos++
      const n = parseFloat(t.value)
      if (isNaN(n)) {
        throw new FormulaError('ERROR', `Bad number: ${t.value}`)
      }
      return n
    }
    if (t.type === 'STRING') {
      this.pos++
      return t.value
    }
    if (t.type === 'LPAREN') {
      this.pos++
      const v = this.comparison()
      if (this.peek()?.type !== 'RPAREN') {
        throw new FormulaError('ERROR', 'Expected )')
      }
      this.pos++
      return v
    }
    if (t.type === 'NAME') {
      if (this.at(1)?.type === 'LPAREN') {
        return this.functionCall()
      }
      const upper = t.value.toUpperCase()
      if (upper === 'TRUE') {
        this.pos++
        return true
      }
      if (upper === 'FALSE') {
        this.pos++
        return false
      }
      this.pos++
      return this.cellValue(t.value)
    }
    throw new FormulaError('ERROR', `Unexpected token: ${t.value}`)
  }

  private functionCall(): FormulaValue {
    const name = this.tokens[this.pos].value.toUpperCase()
    const fn = FUNCTIONS[name]
    if (!fn) {
      throw new FormulaError('NAME', `Unknown function: ${name}`)
    }
    this.pos += 2 // NAME + LPAREN
    const args: FormulaValue[][] = []
    const lazy = name === 'IF'
    const errors: Array<unknown> = []
    // у IF ошибка в невыбранной ветке не должна ломать результат: IF(B1=0;0;A1/B1)
    const arg = () => {
      if (!lazy) {
        return this.parseArg()
      }
      const start = this.pos
      try {
        errors[args.length] = undefined
        return this.parseArg()
      } catch (e) {
        if (!(e instanceof FormulaError)) {
          throw e
        }
        errors[args.length] = e
        this.pos = start
        this.skipArg()
        return [0]
      }
    }
    if (this.peek()?.type !== 'RPAREN') {
      args.push(arg())
      while (this.peek()?.type === 'ARGSEP') {
        this.pos++
        args.push(arg())
      }
    }
    if (this.peek()?.type !== 'RPAREN') {
      throw new FormulaError('ERROR', 'Expected )')
    }
    this.pos++
    if (lazy) {
      // ошибка в условии — всегда ошибка; в ветке — только если ветка выбрана
      const chosen = errors[0] ? 0 : toBoolean(args[0][0]) ? 1 : 2
      if (errors[chosen]) {
        throw errors[chosen]
      }
    }
    return fn.apply(args)
  }

  // пропускает токены аргумента до ',' или ')' на нулевой глубине скобок
  private skipArg(): void {
    let depth = 0
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos].type
      if (t === 'LPAREN') depth++
      else if (t === 'RPAREN') {
        if (depth === 0) return
        depth--
      } else if (t === 'ARGSEP' && depth === 0) return
      this.pos++
    }
  }

  // один аргумент функции -> массив значений (диапазон даёт много)
  private parseArg(): FormulaValue[] {
    if (
      this.peek()?.type === 'NAME' &&
      this.at(1)?.type === 'COLON' &&
      this.at(2)?.type === 'NAME'
    ) {
      const from = this.tokens[this.pos].value
      const to = this.tokens[this.pos + 2].value
      this.pos += 3
      const ids = expandRange(from, to)
      if (!ids.length) {
        throw new FormulaError('REF', `Bad range: ${from}:${to}`)
      }
      return ids.map(id => this.cellValueById(id))
    }
    return [this.comparison()]
  }

  private cellValue(ref: string): FormulaValue {
    const id = refToId(ref)
    if (!id) {
      throw new FormulaError('NAME', `Unknown name: ${ref}`)
    }
    return this.cellValueById(id)
  }

  private cellValueById(id: string): FormulaValue {
    if (this.visiting.has(id)) {
      throw new FormulaError('CIRC', 'Circular reference')
    }
    const raw = this.ctx.getRaw(id)
    if (raw == null || raw === '') {
      return ''
    }
    if (raw.startsWith('=')) {
      this.visiting.add(id)
      try {
        return new Parser(tokenize(raw.slice(1)), this.ctx, this.visiting).parse()
      } finally {
        this.visiting.delete(id)
      }
    }
    return rawToValue(raw)
  }
}

/** Превращает сырой текст ячейки в значение: число если числовое, иначе строка. */
function rawToValue(raw: string): FormulaValue {
  const t = raw.trim()
  if (t === '') {
    return ''
  }
  const n = Number(t)
  if (!Number.isNaN(n)) {
    return n
  }
  return raw
}

/** Вычисляет выражение (без ведущего '='). Бросает FormulaError при ошибке. */
export function evaluate(
    expr: string,
    ctx: FormulaContext,
    visiting: Set<string> = new Set()
): FormulaValue {
  return new Parser(tokenize(expr), ctx, visiting).parse()
}

/**
 * Отображаемое значение ячейки по её id.
 * Текст возвращается как есть; формула (с '=') вычисляется; ошибки -> #...,
 * пустая формула ("=") -> пустая строка.
 */
export function evaluateCell(id: string, ctx: FormulaContext): string {
  const raw = ctx.getRaw(id)
  if (raw == null || raw === '') {
    return ''
  }
  if (!raw.startsWith('=')) {
    return raw
  }
  const body = raw.slice(1)
  if (body.trim() === '') {
    return ''
  }
  try {
    return formatValue(evaluate(body, ctx, new Set<string>([id])))
  } catch (e) {
    return errToString(e)
  }
}
