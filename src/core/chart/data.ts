// Достаёт подписи и числа из диапазона листа для построения графика.
// Ориентация выбирается автоматически: больше строк — серии по строкам,
// больше столбцов — по столбцам (как в Excel).

import type {CellRange, SheetState} from '@/redux/types'
import {evaluateCell, colToLetters} from '@core/formula'
import type {ChartData} from './render'

function makeCtx(sheet: SheetState) {
  return {getRaw: (id: string) => sheet.dataState[id]}
}

function cellText(sheet: SheetState, r: number, c: number): string {
  return String(evaluateCell(`${r}:${c}`, makeCtx(sheet)))
}

function isNumeric(sheet: SheetState, r: number, c: number): boolean {
  const txt = cellText(sheet, r, c).replace(/\s/g, '').replace(',', '.')
  return txt !== '' && !isNaN(Number(txt))
}

function cellNumber(sheet: SheetState, r: number, c: number): number {
  const txt = cellText(sheet, r, c).replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(txt)
  return isNaN(n) ? 0 : n
}

export function chartDataFromRange(
    sheet: SheetState,
    range: CellRange
): ChartData {
  const {r1, c1, r2, c2} = range
  const width = c2 - c1 + 1
  const height = r2 - r1 + 1
  const labels: string[] = []
  const values: number[] = []

  if (height >= width) {
    // серии по строкам; подписи — первый столбец (если он не единственный)
    const hasLabelCol = width >= 2
    const valueCol = hasLabelCol ? c2 : c1
    // первая строка с текстом вместо числа — это шапка, в график не берём
    const skipHead = hasLabelCol && height >= 3 &&
      !isNumeric(sheet, r1, valueCol) && isNumeric(sheet, r1 + 1, valueCol)
    for (let r = skipHead ? r1 + 1 : r1; r <= r2; r++) {
      const label = hasLabelCol
        ? cellText(sheet, r, c1)
        : (sheet.rowTitles[r] || String(r + 1))
      labels.push(label || String(r + 1))
      values.push(cellNumber(sheet, r, valueCol))
    }
  } else {
    // серии по столбцам; подписи — первая строка (если она не единственная)
    const hasLabelRow = height >= 2
    const valueRow = hasLabelRow ? r2 : r1
    const skipHead = hasLabelRow && width >= 3 &&
      !isNumeric(sheet, valueRow, c1) && isNumeric(sheet, valueRow, c1 + 1)
    for (let c = skipHead ? c1 + 1 : c1; c <= c2; c++) {
      const label = hasLabelRow
        ? cellText(sheet, r1, c)
        : (sheet.colTitles[c] || colToLetters(c))
      labels.push(label || colToLetters(c))
      values.push(cellNumber(sheet, valueRow, c))
    }
  }
  return {labels, values}
}
