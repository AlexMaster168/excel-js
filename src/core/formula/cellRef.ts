// Конвертация ссылок Excel-стиля ("A1") в наш id ячейки ("row:col") и обратно.
// row и col — 0-based (как в dataState: "A1" -> "0:0", "B3" -> "2:1").

export interface CellPos {
  row: number
  col: number
}

/** "A" -> 0, "B" -> 1, "Z" -> 25, "AA" -> 26 (base-26, A=1). */
export function lettersToCol(letters: string): number {
  let col = 0
  const up = letters.toUpperCase()
  for (let i = 0; i < up.length; i++) {
    col = col * 26 + (up.charCodeAt(i) - 64)
  }
  return col - 1
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function colToLetters(col: number): string {
  let n = col + 1
  let res = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    res = String.fromCharCode(65 + rem) + res
    n = Math.floor((n - 1) / 26)
  }
  return res
}

/** "A1" -> {row:0, col:0}. Возвращает null при невалидной ссылке. */
export function parseRef(ref: string): CellPos | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim())
  if (!m) {
    return null
  }
  const col = lettersToCol(m[1])
  const row = parseInt(m[2], 10) - 1
  if (row < 0) {
    return null
  }
  return {row, col}
}

export function posToId(pos: CellPos): string {
  return `${pos.row}:${pos.col}`
}

export function refToId(ref: string): string | null {
  const pos = parseRef(ref)
  return pos ? posToId(pos) : null
}

/** Раскрывает диапазон "A1".."B3" в список id ячеек прямоугольника. */
export function expandRange(from: string, to: string): string[] {
  const a = parseRef(from)
  const b = parseRef(to)
  if (!a || !b) {
    return []
  }
  const r1 = Math.min(a.row, b.row)
  const r2 = Math.max(a.row, b.row)
  const c1 = Math.min(a.col, b.col)
  const c2 = Math.max(a.col, b.col)
  const ids: string[] = []
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ids.push(`${r}:${c}`)
    }
  }
  return ids
}
