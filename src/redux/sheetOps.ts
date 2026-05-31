// Чистые операции над листом: удаление и вставка строк/столбцов со сдвигом
// всех зависимых данных (ячейки, стили, размеры, заголовки, объекты-таблицы,
// графики). Вынесено отдельно, чтобы покрыть тестами без UI и стора.

import type {CellRange, CellStyles, ClipCell, SheetState} from '@/redux/types'

type Axis = 'row' | 'col'

/** Разбирает "row:col" в числа. */
function parseId(id: string): {row: number; col: number} {
  const [row, col] = id.split(':').map(Number)
  return {row, col}
}

/**
 * Сдвигает ключи-ячейки ("row:col") по оси: индекс на удаляемой/вставляемой
 * линии обрабатывается через `shift` (возвращает новый индекс или null — выкинуть).
 */
function shiftCellMap<T>(
    map: Record<string, T>,
    axis: Axis,
    shift: (i: number) => number | null
): Record<string, T> {
  const next: Record<string, T> = {}
  for (const id of Object.keys(map)) {
    const {row, col} = parseId(id)
    const target = axis === 'row' ? row : col
    const moved = shift(target)
    if (moved === null) {
      continue
    }
    const key = axis === 'row' ? `${moved}:${col}` : `${row}:${moved}`
    next[key] = map[id]
  }
  return next
}

/** Сдвигает ключи-индексы (rowState/colState/rowTitles/colTitles). */
function shiftIndexMap<T>(
    map: Record<string, T>,
    shift: (i: number) => number | null
): Record<string, T> {
  const next: Record<string, T> = {}
  for (const key of Object.keys(map)) {
    const moved = shift(Number(key))
    if (moved === null) {
      continue
    }
    next[moved] = map[key]
  }
  return next
}

/**
 * Корректирует диапазон объекта при удалении линии `index` по оси.
 * Возвращает новый диапазон или null, если он схлопнулся (объект удалить).
 */
function rangeAfterDelete(
    range: CellRange,
    axis: Axis,
    index: number
): CellRange | null {
  const lo = axis === 'row' ? range.r1 : range.c1
  const hi = axis === 'row' ? range.r2 : range.c2
  let nLo = lo
  let nHi = hi
  if (index < lo) {
    nLo = lo - 1
    nHi = hi - 1
  } else if (index <= hi) {
    nHi = hi - 1
  }
  if (nHi < nLo) {
    return null
  }
  return axis === 'row'
    ? {...range, r1: nLo, r2: nHi}
    : {...range, c1: nLo, c2: nHi}
}

/** Корректирует диапазон при вставке линии перед `index` по оси. */
function rangeAfterInsert(
    range: CellRange,
    axis: Axis,
    index: number
): CellRange {
  const lo = axis === 'row' ? range.r1 : range.c1
  const hi = axis === 'row' ? range.r2 : range.c2
  let nLo = lo
  let nHi = hi
  if (index <= lo) {
    nLo = lo + 1
    nHi = hi + 1
  } else if (index <= hi) {
    nHi = hi + 1
  }
  return axis === 'row'
    ? {...range, r1: nLo, r2: nHi}
    : {...range, c1: nLo, c2: nHi}
}

/** Удаляет строку или столбец `index`, сдвигая всё что после. */
export function deleteAxis(
    sheet: SheetState,
    axis: Axis,
    index: number
): SheetState {
  const shift = (i: number): number | null => {
    if (i === index) {
      return null
    }
    return i > index ? i - 1 : i
  }
  const idxField = axis === 'row' ? 'rowState' : 'colState'
  const titleField = axis === 'row' ? 'rowTitles' : 'colTitles'
  const countField = axis === 'row' ? 'rowsCount' : 'colsCount'

  return {
    ...sheet,
    dataState: shiftCellMap(sheet.dataState, axis, shift),
    stylesState: shiftCellMap(sheet.stylesState, axis, shift),
    [idxField]: shiftIndexMap(sheet[idxField], shift),
    [titleField]: shiftIndexMap(sheet[titleField], shift),
    [countField]: Math.max(1, sheet[countField] - 1),
    tables: sheet.tables
        .map(t => {
          const range = rangeAfterDelete(t.range, axis, index)
          return range ? {...t, range} : null
        })
        .filter((t): t is NonNullable<typeof t> => t !== null),
    charts: sheet.charts
        .map(c => {
          const range = rangeAfterDelete(c.range, axis, index)
          return range ? {...c, range} : null
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
  }
}

/** Вставляет пустую строку или столбец перед `index`, сдвигая всё что дальше. */
export function insertAxis(
    sheet: SheetState,
    axis: Axis,
    index: number
): SheetState {
  const shift = (i: number): number => (i >= index ? i + 1 : i)
  const idxField = axis === 'row' ? 'rowState' : 'colState'
  const titleField = axis === 'row' ? 'rowTitles' : 'colTitles'
  const countField = axis === 'row' ? 'rowsCount' : 'colsCount'

  return {
    ...sheet,
    dataState: shiftCellMap(sheet.dataState, axis, shift),
    stylesState: shiftCellMap(sheet.stylesState, axis, shift),
    [idxField]: shiftIndexMap(sheet[idxField], shift),
    [titleField]: shiftIndexMap(sheet[titleField], shift),
    [countField]: sheet[countField] + 1,
    tables: sheet.tables.map(t => ({
      ...t,
      range: rangeAfterInsert(t.range, axis, index)
    })),
    charts: sheet.charts.map(c => ({
      ...c,
      range: rangeAfterInsert(c.range, axis, index)
    }))
  }
}

/**
 * Перемещает содержимое диапазона (данные + стили) на смещение (dRow, dCol).
 * Возвращает тот же sheet (===), если смещение выводит за левый/верхний край
 * — вызывающий трактует это как no-op. Таблицы/графики не трогает.
 */
export function moveRange(
    sheet: SheetState,
    range: CellRange,
    dRow: number,
    dCol: number
): SheetState {
  if (dRow === 0 && dCol === 0) {
    return sheet
  }
  if (range.r1 + dRow < 0 || range.c1 + dCol < 0) {
    return sheet
  }
  // снимок содержимого диапазона
  const grabbed: Array<{r: number; c: number; data?: string; style?: CellStyles}> = []
  for (let r = range.r1; r <= range.r2; r++) {
    for (let c = range.c1; c <= range.c2; c++) {
      grabbed.push({
        r, c,
        data: sheet.dataState[`${r}:${c}`],
        style: sheet.stylesState[`${r}:${c}`]
      })
    }
  }
  const dataState = {...sheet.dataState}
  const stylesState = {...sheet.stylesState}
  // сначала очищаем старые позиции (важно при пересечении старого и нового)
  for (const g of grabbed) {
    delete dataState[`${g.r}:${g.c}`]
    delete stylesState[`${g.r}:${g.c}`]
  }
  // затем кладём на новые
  for (const g of grabbed) {
    const key = `${g.r + dRow}:${g.c + dCol}`
    if (g.data !== undefined) {
      dataState[key] = g.data
    }
    if (g.style !== undefined) {
      stylesState[key] = g.style
    }
  }
  return {
    ...sheet,
    dataState,
    stylesState,
    rowsCount: Math.max(sheet.rowsCount, range.r2 + dRow + 1),
    colsCount: Math.max(sheet.colsCount, range.c2 + dCol + 1)
  }
}

/** Вставляет прямоугольный блок ячеек начиная с (row, col), расширяя лист. */
export function pasteRange(
    sheet: SheetState,
    row: number,
    col: number,
    cells: ClipCell[][]
): SheetState {
  if (!cells.length) {
    return sheet
  }
  const dataState = {...sheet.dataState}
  const stylesState = {...sheet.stylesState}
  let maxR = sheet.rowsCount - 1
  let maxC = sheet.colsCount - 1
  cells.forEach((line, i) => {
    line.forEach((cell, j) => {
      const r = row + i
      const c = col + j
      const key = `${r}:${c}`
      if (cell.value === '' || cell.value === undefined) {
        delete dataState[key]
      } else {
        dataState[key] = cell.value
      }
      if (cell.style) {
        stylesState[key] = cell.style
      }
      if (r > maxR) {
        maxR = r
      }
      if (c > maxC) {
        maxC = c
      }
    })
  })
  return {
    ...sheet,
    dataState,
    stylesState,
    rowsCount: maxR + 1,
    colsCount: maxC + 1
  }
}
