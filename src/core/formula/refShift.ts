// Перепись ссылок в формулах при вставке/удалении строк и столбцов (как в Excel):
// A5 после вставки строки выше -> A6; ссылка на удалённую ячейку -> #REF!;
// диапазоны сжимаются/растягиваются.

import {colToLetters, lettersToCol} from '@core/formula/cellRef'

type Axis = 'row' | 'col'
type Kind = 'insert' | 'delete'

interface Ref {
  colAbs: string
  col: number
  rowAbs: string
  row: number
}

const REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/

function parse(text: string): Ref | null {
  const m = REF.exec(text)
  if (!m) {
    return null
  }
  return {colAbs: m[1], col: lettersToCol(m[2]), rowAbs: m[3], row: Number(m[4]) - 1}
}

function print(r: Ref): string {
  return `${r.colAbs}${colToLetters(r.col)}${r.rowAbs}${r.row + 1}`
}

/** Новый индекс одиночной ссылки или null (ссылка умерла). */
function shiftIndex(i: number, kind: Kind, index: number): number | null {
  if (kind === 'insert') {
    return i >= index ? i + 1 : i
  }
  if (i === index) {
    return null
  }
  return i > index ? i - 1 : i
}

/** Новые границы диапазона по оси или null (схлопнулся). */
function shiftSpan(lo: number, hi: number, kind: Kind, index: number): [number, number] | null {
  if (kind === 'insert') {
    if (index <= lo) {
      return [lo + 1, hi + 1]
    }
    return index <= hi ? [lo, hi + 1] : [lo, hi]
  }
  let nLo = lo
  let nHi = hi
  if (index < lo) {
    nLo--
    nHi--
  } else if (index <= hi) {
    nHi--
  }
  return nHi < nLo ? null : [nLo, nHi]
}

function shiftRef(text: string, axis: Axis, kind: Kind, index: number): string {
  const r = parse(text)
  if (!r) {
    return text
  }
  const moved = shiftIndex(axis === 'row' ? r.row : r.col, kind, index)
  if (moved === null) {
    return '#REF!'
  }
  return print(axis === 'row' ? {...r, row: moved} : {...r, col: moved})
}

function shiftRange(a: string, b: string, axis: Axis, kind: Kind, index: number): string {
  const ra = parse(a)
  const rb = parse(b)
  if (!ra || !rb) {
    return `${a}:${b}`
  }
  const key = axis
  const swap = ra[key] > rb[key]
  const [lo, hi] = swap ? [rb, ra] : [ra, rb]
  const span = shiftSpan(lo[key], hi[key], kind, index)
  if (!span) {
    return '#REF!'
  }
  const nLo = {...lo, [key]: span[0]}
  const nHi = {...hi, [key]: span[1]}
  return swap ? `${print(nHi)}:${print(nLo)}` : `${print(nLo)}:${print(nHi)}`
}

const REFS = /(?<![A-Za-z0-9_.$])(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![A-Za-z0-9_(])/g

/**
 * Переписывает ссылки сырого значения ячейки. Не-формулы возвращает как есть.
 * Строковые литералы "..." не трогает.
 */
export function shiftFormula(raw: string, axis: Axis, kind: Kind, index: number): string {
  if (!raw.startsWith('=')) {
    return raw
  }
  return raw
      .split(/("[^"]*")/)
      .map((part, i) => i % 2 === 1
        ? part
        : part.replace(REFS, (_m, a: string, b?: string) =>
          b ? shiftRange(a, b, axis, kind, index) : shiftRef(a, axis, kind, index)))
      .join('')
}

function translateRef(text: string, dRow: number, dCol: number): string {
  const r = parse(text)
  if (!r) {
    return text
  }
  const row = r.rowAbs ? r.row : r.row + dRow
  const col = r.colAbs ? r.col : r.col + dCol
  return row < 0 || col < 0 ? '#REF!' : print({...r, row, col})
}

/**
 * Копирование формулы со смещением (copy/paste): относительные ссылки едут,
 * абсолютные ($A$1) остаются на месте, как в Excel.
 */
export function translateFormula(raw: string, dRow: number, dCol: number): string {
  if (!raw.startsWith('=') || (dRow === 0 && dCol === 0)) {
    return raw
  }
  return raw
      .split(/("[^"]*")/)
      .map((part, i) => i % 2 === 1
        ? part
        : part.replace(REFS, (_m, a: string, b?: string) => {
          const ta = translateRef(a, dRow, dCol)
          const tb = b ? translateRef(b, dRow, dCol) : ''
          return ta === '#REF!' || tb === '#REF!' ? '#REF!' : b ? `${ta}:${tb}` : ta
        }))
      .join('')
}
