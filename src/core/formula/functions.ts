import {
  FormulaError,
  toBoolean,
  toNumber,
  toText
} from '@core/formula/values'
import type {FormulaValue} from '@core/formula/values'

export type FunctionCategory = 'math' | 'stat' | 'logic' | 'text' | 'date'

export const CATEGORY_LABELS: Record<FunctionCategory, string> = {
  math: 'Математические',
  stat: 'Статистические',
  logic: 'Логические',
  text: 'Текстовые',
  date: 'Дата и время'
}

export interface FormulaFunction {
  name: string
  category: FunctionCategory
  description: string
  syntax: string
  apply: (args: FormulaValue[][]) => FormulaValue
}

// --- Хелперы для работы с аргументами ---
// Каждый аргумент — массив значений: скаляр это [v], диапазон A1:B3 это [v1, v2, ...].

/** Все числа из всех аргументов (нечисловой текст/пустые игнорируются). */
function nums(args: FormulaValue[][]): number[] {
  const out: number[] = []
  for (const arg of args) {
    for (const v of arg) {
      if (typeof v === 'number') {
        out.push(v)
      } else if (typeof v === 'boolean') {
        out.push(v ? 1 : 0)
      } else if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v)
        if (!Number.isNaN(n)) {
          out.push(n)
        }
      }
    }
  }
  return out
}

/** Числа из одного аргумента (диапазона). */
function colNums(arg: FormulaValue[] | undefined): number[] {
  return arg ? nums([arg]) : []
}

/** Все значения плоско. */
function flat(args: FormulaValue[][]): FormulaValue[] {
  return args.flat()
}

function first(arg: FormulaValue[] | undefined): FormulaValue {
  return arg && arg.length ? arg[0] : ''
}

function num(args: FormulaValue[][], i: number, def?: number): number {
  const arg = args[i]
  if ((!arg || arg.length === 0) && def !== undefined) {
    return def
  }
  return toNumber(first(arg))
}

function str(args: FormulaValue[][], i: number): string {
  return toText(first(args[i]))
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}

function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : 0
}

function variance(xs: number[], population: boolean): number {
  const n = xs.length
  if (n < (population ? 1 : 2)) {
    throw new FormulaError('DIV/0', 'Not enough data')
  }
  const m = mean(xs)
  const ss = xs.reduce((a, x) => a + (x - m) * (x - m), 0)
  return ss / (population ? n : n - 1)
}

function correl(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n === 0) {
    throw new FormulaError('DIV/0', 'Empty range')
  }
  let sx = 0; let sy = 0; let sxy = 0; let sx2 = 0; let sy2 = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i]
    sxy += xs[i] * ys[i]
    sx2 += xs[i] * xs[i]; sy2 += ys[i] * ys[i]
  }
  const den = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy))
  if (den === 0) {
    throw new FormulaError('DIV/0', 'Zero variance')
  }
  return (n * sxy - sx * sy) / den
}

function factorial(n: number): number {
  const k = Math.floor(n)
  if (k < 0) {
    throw new FormulaError('VALUE', 'FACT of negative')
  }
  let res = 1
  for (let i = 2; i <= k; i++) {
    res *= i
  }
  return res
}

function gcd2(a: number, b: number): number {
  a = Math.abs(Math.floor(a)); b = Math.abs(Math.floor(b))
  while (b) {
    [a, b] = [b, a % b]
  }
  return a
}

function roundTo(x: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round((x + Number.EPSILON) * f) / f
}

function reg(fns: FormulaFunction[]): Record<string, FormulaFunction> {
  const map: Record<string, FormulaFunction> = {}
  for (const f of fns) {
    map[f.name] = f
  }
  return map
}

// --- Реестр функций ---

export const FUNCTIONS: Record<string, FormulaFunction> = reg([
  // ===== Математические =====
  {name: 'SUM', category: 'math', description: 'Сумма всех чисел', syntax: 'SUM(число1; [число2]; …)', apply: a => sum(nums(a))},
  {name: 'PRODUCT', category: 'math', description: 'Произведение чисел', syntax: 'PRODUCT(число1; …)', apply: a => nums(a).reduce((x, y) => x * y, 1)},
  {name: 'ABS', category: 'math', description: 'Модуль числа', syntax: 'ABS(число)', apply: a => Math.abs(num(a, 0))},
  {name: 'SIGN', category: 'math', description: 'Знак числа (-1, 0, 1)', syntax: 'SIGN(число)', apply: a => Math.sign(num(a, 0))},
  {name: 'SQRT', category: 'math', description: 'Квадратный корень', syntax: 'SQRT(число)', apply: a => Math.sqrt(num(a, 0))},
  {name: 'POWER', category: 'math', description: 'Возведение в степень', syntax: 'POWER(основание; степень)', apply: a => Math.pow(num(a, 0), num(a, 1))},
  {name: 'EXP', category: 'math', description: 'e в степени', syntax: 'EXP(число)', apply: a => Math.exp(num(a, 0))},
  {name: 'LN', category: 'math', description: 'Натуральный логарифм', syntax: 'LN(число)', apply: a => Math.log(num(a, 0))},
  {name: 'LOG', category: 'math', description: 'Логарифм по основанию (по умолч. 10)', syntax: 'LOG(число; [основание])', apply: a => Math.log(num(a, 0)) / Math.log(num(a, 1, 10))},
  {name: 'LOG10', category: 'math', description: 'Десятичный логарифм', syntax: 'LOG10(число)', apply: a => Math.log10(num(a, 0))},
  {name: 'MOD', category: 'math', description: 'Остаток от деления', syntax: 'MOD(число; делитель)', apply: a => {
    const d = num(a, 1)
    if (d === 0) {
      throw new FormulaError('DIV/0', 'mod by zero')
    }
    return num(a, 0) % d
  }},
  {name: 'INT', category: 'math', description: 'Округление вниз до целого', syntax: 'INT(число)', apply: a => Math.floor(num(a, 0))},
  {name: 'TRUNC', category: 'math', description: 'Отбрасывание дробной части', syntax: 'TRUNC(число)', apply: a => Math.trunc(num(a, 0))},
  {name: 'ROUND', category: 'math', description: 'Округление до N знаков', syntax: 'ROUND(число; знаки)', apply: a => roundTo(num(a, 0), num(a, 1, 0))},
  {name: 'ROUNDUP', category: 'math', description: 'Округление вверх', syntax: 'ROUNDUP(число; знаки)', apply: a => {
    const f = Math.pow(10, num(a, 1, 0)); const x = num(a, 0)
    return (x < 0 ? -Math.ceil(-x * f) : Math.ceil(x * f)) / f
  }},
  {name: 'ROUNDDOWN', category: 'math', description: 'Округление вниз', syntax: 'ROUNDDOWN(число; знаки)', apply: a => {
    const f = Math.pow(10, num(a, 1, 0)); const x = num(a, 0)
    return Math.trunc(x * f) / f
  }},
  {name: 'CEILING', category: 'math', description: 'Округление вверх до кратного', syntax: 'CEILING(число; [точность])', apply: a => {
    const s = num(a, 1, 1)
    return s === 0 ? 0 : Math.ceil(num(a, 0) / s) * s
  }},
  {name: 'FLOOR', category: 'math', description: 'Округление вниз до кратного', syntax: 'FLOOR(число; [точность])', apply: a => {
    const s = num(a, 1, 1)
    return s === 0 ? 0 : Math.floor(num(a, 0) / s) * s
  }},
  {name: 'PI', category: 'math', description: 'Число π', syntax: 'PI()', apply: () => Math.PI},
  {name: 'DEGREES', category: 'math', description: 'Радианы → градусы', syntax: 'DEGREES(угол)', apply: a => num(a, 0) * 180 / Math.PI},
  {name: 'RADIANS', category: 'math', description: 'Градусы → радианы', syntax: 'RADIANS(угол)', apply: a => num(a, 0) * Math.PI / 180},
  {name: 'SIN', category: 'math', description: 'Синус (радианы)', syntax: 'SIN(угол)', apply: a => Math.sin(num(a, 0))},
  {name: 'COS', category: 'math', description: 'Косинус (радианы)', syntax: 'COS(угол)', apply: a => Math.cos(num(a, 0))},
  {name: 'TAN', category: 'math', description: 'Тангенс (радианы)', syntax: 'TAN(угол)', apply: a => Math.tan(num(a, 0))},
  {name: 'ASIN', category: 'math', description: 'Арксинус', syntax: 'ASIN(число)', apply: a => Math.asin(num(a, 0))},
  {name: 'ACOS', category: 'math', description: 'Арккосинус', syntax: 'ACOS(число)', apply: a => Math.acos(num(a, 0))},
  {name: 'ATAN', category: 'math', description: 'Арктангенс', syntax: 'ATAN(число)', apply: a => Math.atan(num(a, 0))},
  {name: 'ATAN2', category: 'math', description: 'Арктангенс по координатам', syntax: 'ATAN2(x; y)', apply: a => Math.atan2(num(a, 1), num(a, 0))},
  {name: 'FACT', category: 'math', description: 'Факториал', syntax: 'FACT(число)', apply: a => factorial(num(a, 0))},
  {name: 'GCD', category: 'math', description: 'Наибольший общий делитель', syntax: 'GCD(число1; …)', apply: a => nums(a).reduce((x, y) => gcd2(x, y), 0)},
  {name: 'LCM', category: 'math', description: 'Наименьшее общее кратное', syntax: 'LCM(число1; …)', apply: a => nums(a).reduce((x, y) => (x === 0 || y === 0 ? 0 : Math.abs(x * y) / gcd2(x, y)), 1)},
  {name: 'SUMSQ', category: 'math', description: 'Сумма квадратов', syntax: 'SUMSQ(число1; …)', apply: a => sum(nums(a).map(x => x * x))},
  {name: 'SUMPRODUCT', category: 'math', description: 'Сумма произведений двух диапазонов', syntax: 'SUMPRODUCT(диап1; диап2)', apply: a => {
    const xs = colNums(a[0]); const ys = colNums(a[1])
    const n = Math.min(xs.length, ys.length)
    let s = 0
    for (let i = 0; i < n; i++) {
      s += xs[i] * ys[i]
    }
    return s
  }},

  // ===== Статистические / вышмат =====
  {name: 'AVERAGE', category: 'stat', description: 'Среднее арифметическое', syntax: 'AVERAGE(число1; …)', apply: a => mean(nums(a))},
  {name: 'AVG', category: 'stat', description: 'Среднее (алиас AVERAGE)', syntax: 'AVG(число1; …)', apply: a => mean(nums(a))},
  {name: 'MIN', category: 'stat', description: 'Минимум', syntax: 'MIN(число1; …)', apply: a => {
    const xs = nums(a)
    return xs.length ? Math.min(...xs) : 0
  }},
  {name: 'MAX', category: 'stat', description: 'Максимум', syntax: 'MAX(число1; …)', apply: a => {
    const xs = nums(a)
    return xs.length ? Math.max(...xs) : 0
  }},
  {name: 'COUNT', category: 'stat', description: 'Количество чисел', syntax: 'COUNT(значение1; …)', apply: a => nums(a).length},
  {name: 'COUNTA', category: 'stat', description: 'Количество непустых значений', syntax: 'COUNTA(значение1; …)', apply: a => flat(a).filter(v => !(typeof v === 'string' && v === '')).length},
  {name: 'MEDIAN', category: 'stat', description: 'Медиана', syntax: 'MEDIAN(число1; …)', apply: a => {
    const xs = nums(a).slice().sort((x, y) => x - y)
    if (!xs.length) {
      return 0
    }
    const mid = Math.floor(xs.length / 2)
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
  }},
  {name: 'MODE', category: 'stat', description: 'Наиболее частое значение', syntax: 'MODE(число1; …)', apply: a => {
    const xs = nums(a)
    const counts = new Map<number, number>()
    let best = xs[0] ?? 0; let bestC = 0
    for (const x of xs) {
      const c = (counts.get(x) || 0) + 1
      counts.set(x, c)
      if (c > bestC) {
        bestC = c; best = x
      }
    }
    return best
  }},
  {name: 'STDEV', category: 'stat', description: 'Стандартное отклонение (выборка)', syntax: 'STDEV(число1; …)', apply: a => Math.sqrt(variance(nums(a), false))},
  {name: 'STDEVP', category: 'stat', description: 'Стандартное отклонение (ген. совокупность)', syntax: 'STDEVP(число1; …)', apply: a => Math.sqrt(variance(nums(a), true))},
  {name: 'VAR', category: 'stat', description: 'Дисперсия (выборка)', syntax: 'VAR(число1; …)', apply: a => variance(nums(a), false)},
  {name: 'VARP', category: 'stat', description: 'Дисперсия (ген. совокупность)', syntax: 'VARP(число1; …)', apply: a => variance(nums(a), true)},
  {name: 'CORREL', category: 'stat', description: 'Коэффициент корреляции Пирсона', syntax: 'CORREL(диап1; диап2)', apply: a => correl(colNums(a[0]), colNums(a[1]))},
  {name: 'GEOMEAN', category: 'stat', description: 'Среднее геометрическое', syntax: 'GEOMEAN(число1; …)', apply: a => {
    const xs = nums(a)
    if (!xs.length) {
      return 0
    }
    return Math.pow(xs.reduce((p, x) => p * x, 1), 1 / xs.length)
  }},
  {name: 'RANK', category: 'stat', description: 'Ранг числа в диапазоне (по убыванию)', syntax: 'RANK(число; диапазон)', apply: a => {
    const x = num(a, 0); const xs = colNums(a[1])
    return 1 + xs.filter(v => v > x).length
  }},

  // ===== Логические =====
  {name: 'IF', category: 'logic', description: 'Условие: если ИСТИНА — одно, иначе другое', syntax: 'IF(условие; значение_да; значение_нет)', apply: a => toBoolean(first(a[0])) ? first(a[1]) : first(a[2])},
  {name: 'AND', category: 'logic', description: 'ИСТИНА, если все аргументы истинны', syntax: 'AND(лог1; …)', apply: a => flat(a).every(v => toBoolean(v))},
  {name: 'OR', category: 'logic', description: 'ИСТИНА, если хотя бы один истинен', syntax: 'OR(лог1; …)', apply: a => flat(a).some(v => toBoolean(v))},
  {name: 'NOT', category: 'logic', description: 'Логическое отрицание', syntax: 'NOT(логическое)', apply: a => !toBoolean(first(a[0]))},
  {name: 'XOR', category: 'logic', description: 'Исключающее ИЛИ', syntax: 'XOR(лог1; …)', apply: a => flat(a).filter(v => toBoolean(v)).length % 2 === 1},
  {name: 'TRUE', category: 'logic', description: 'Логическая ИСТИНА', syntax: 'TRUE()', apply: () => true},
  {name: 'FALSE', category: 'logic', description: 'Логическая ЛОЖЬ', syntax: 'FALSE()', apply: () => false},

  // ===== Текстовые =====
  {name: 'CONCAT', category: 'text', description: 'Объединение текста', syntax: 'CONCAT(текст1; …)', apply: a => flat(a).map(toText).join('')},
  {name: 'CONCATENATE', category: 'text', description: 'Объединение текста', syntax: 'CONCATENATE(текст1; …)', apply: a => flat(a).map(toText).join('')},
  {name: 'LEN', category: 'text', description: 'Длина текста', syntax: 'LEN(текст)', apply: a => str(a, 0).length},
  {name: 'UPPER', category: 'text', description: 'В верхний регистр', syntax: 'UPPER(текст)', apply: a => str(a, 0).toUpperCase()},
  {name: 'LOWER', category: 'text', description: 'В нижний регистр', syntax: 'LOWER(текст)', apply: a => str(a, 0).toLowerCase()},
  {name: 'TRIM', category: 'text', description: 'Убрать лишние пробелы', syntax: 'TRIM(текст)', apply: a => str(a, 0).trim().replace(/\s+/g, ' ')},
  {name: 'LEFT', category: 'text', description: 'Левые N символов', syntax: 'LEFT(текст; [N])', apply: a => str(a, 0).slice(0, num(a, 1, 1))},
  {name: 'RIGHT', category: 'text', description: 'Правые N символов', syntax: 'RIGHT(текст; [N])', apply: a => {
    const n = num(a, 1, 1)
    return n <= 0 ? '' : str(a, 0).slice(-n)
  }},
  {name: 'MID', category: 'text', description: 'Подстрока с позиции', syntax: 'MID(текст; начало; длина)', apply: a => str(a, 0).substr(num(a, 1) - 1, num(a, 2))},
  {name: 'REPT', category: 'text', description: 'Повторить текст N раз', syntax: 'REPT(текст; N)', apply: a => str(a, 0).repeat(Math.max(0, Math.floor(num(a, 1))))},
  {name: 'PROPER', category: 'text', description: 'Каждое слово с заглавной', syntax: 'PROPER(текст)', apply: a => str(a, 0).replace(/\b\w/g, c => c.toUpperCase())},
  {name: 'EXACT', category: 'text', description: 'Точное совпадение текста', syntax: 'EXACT(текст1; текст2)', apply: a => str(a, 0) === str(a, 1)},
  {name: 'FIND', category: 'text', description: 'Позиция подстроки (с учётом регистра)', syntax: 'FIND(искомое; текст; [нач])', apply: a => {
    const pos = str(a, 1).indexOf(str(a, 0), num(a, 2, 1) - 1)
    if (pos < 0) {
      throw new FormulaError('VALUE', 'not found')
    }
    return pos + 1
  }},
  {name: 'SUBSTITUTE', category: 'text', description: 'Замена подстроки', syntax: 'SUBSTITUTE(текст; старое; новое)', apply: a => str(a, 0).split(str(a, 1)).join(str(a, 2))},
  {name: 'TEXTJOIN', category: 'text', description: 'Объединить с разделителем', syntax: 'TEXTJOIN(разделитель; диапазон)', apply: a => {
    const sep = str(a, 0)
    return a.slice(1).flat().map(toText).filter(s => s !== '').join(sep)
  }},

  // ===== Дата и время =====
  {name: 'TODAY', category: 'date', description: 'Текущая дата', syntax: 'TODAY()', apply: () => new Date().toLocaleDateString()},
  {name: 'NOW', category: 'date', description: 'Текущие дата и время', syntax: 'NOW()', apply: () => new Date().toLocaleString()},
  {name: 'DATE', category: 'date', description: 'Собрать дату из частей', syntax: 'DATE(год; месяц; день)', apply: a => new Date(num(a, 0), num(a, 1) - 1, num(a, 2)).toLocaleDateString()},
  {name: 'YEAR', category: 'date', description: 'Год из даты', syntax: 'YEAR(дата)', apply: a => new Date(str(a, 0)).getFullYear()},
  {name: 'MONTH', category: 'date', description: 'Месяц из даты', syntax: 'MONTH(дата)', apply: a => new Date(str(a, 0)).getMonth() + 1},
  {name: 'DAY', category: 'date', description: 'День из даты', syntax: 'DAY(дата)', apply: a => new Date(str(a, 0)).getDate()}
])

export const FUNCTION_LIST: FormulaFunction[] = Object.values(FUNCTIONS)
