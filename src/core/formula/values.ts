// Значение формулы и приведения типов (число / текст / логика).

export type FormulaValue = number | string | boolean

export type ErrCode = 'ERROR' | 'DIV/0' | 'CIRC' | 'REF' | 'NAME' | 'VALUE'

export class FormulaError extends Error {
  code: ErrCode
  constructor(code: ErrCode, message: string) {
    super(message)
    this.name = 'FormulaError'
    this.code = code
  }
}

export function errToString(e: unknown): string {
  if (e instanceof FormulaError) {
    switch (e.code) {
      case 'DIV/0': return '#DIV/0!'
      case 'CIRC': return '#CIRC!'
      case 'REF': return '#REF!'
      case 'NAME': return '#NAME?'
      case 'VALUE': return '#VALUE!'
      default: return '#ERROR!'
    }
  }
  return '#ERROR!'
}

/** Приводит значение к числу. Нечисловой текст -> #VALUE!. */
export function toNumber(v: FormulaValue): number {
  if (typeof v === 'number') {
    return v
  }
  if (typeof v === 'boolean') {
    return v ? 1 : 0
  }
  const s = v.trim()
  if (s === '') {
    return 0
  }
  const n = Number(s)
  if (Number.isNaN(n)) {
    throw new FormulaError('VALUE', `Not a number: "${v}"`)
  }
  return n
}

export function toText(v: FormulaValue): string {
  if (typeof v === 'string') {
    return v
  }
  if (typeof v === 'boolean') {
    return v ? 'TRUE' : 'FALSE'
  }
  return String(v)
}

export function toBoolean(v: FormulaValue): boolean {
  if (typeof v === 'boolean') {
    return v
  }
  if (typeof v === 'number') {
    return v !== 0
  }
  const s = v.trim().toUpperCase()
  if (s === 'TRUE') {
    return true
  }
  if (s === 'FALSE' || s === '') {
    return false
  }
  return true
}

/** Сравнение двух значений: <0, 0, >0. Числа — численно, иначе текстово (без регистра). */
export function compareValues(a: FormulaValue, b: FormulaValue): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return (a ? 1 : 0) - (b ? 1 : 0)
  }
  const sa = toText(a).toLowerCase()
  const sb = toText(b).toLowerCase()
  if (sa < sb) {
    return -1
  }
  if (sa > sb) {
    return 1
  }
  return 0
}

/** Отображение результата формулы. */
export function formatValue(v: FormulaValue): string {
  if (typeof v === 'boolean') {
    return v ? 'TRUE' : 'FALSE'
  }
  if (typeof v === 'number') {
    if (!isFinite(v)) {
      return '#ERROR!'
    }
    // срезаем артефакты плавающей точки (0.1 + 0.2 -> 0.3)
    return String(Math.round((v + Number.EPSILON) * 1e10) / 1e10)
  }
  return v
}
