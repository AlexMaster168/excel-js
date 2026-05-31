// Экспорт документа в .xlsx через SheetJS (ленивая загрузка — не в основном бандле).
// Первая строка каждого листа — названия столбцов (симметрично импорту),
// формулы выгружаются как вычисленные значения.

import {evaluateCell} from '@core/formula'
import type {AppState, SheetState} from '@/redux/types'

const NUMERIC = /^-?\d+(\.\d+)?$/

/** Границы заполненной области листа (по данным и заголовкам столбцов). */
function bounds(sheet: SheetState): {maxR: number; maxC: number} {
  let maxR = -1
  let maxC = -1
  for (const id of Object.keys(sheet.dataState)) {
    const [r, c] = id.split(':').map(Number)
    if (r > maxR) maxR = r
    if (c > maxC) maxC = c
  }
  for (const c of Object.keys(sheet.colTitles)) {
    const n = Number(c)
    if (n > maxC) maxC = n
  }
  return {maxR, maxC}
}

/** Лист -> массив массивов (значения), число где это число. */
function sheetToAoa(sheet: SheetState): Array<Array<string | number | null>> {
  const {maxR, maxC} = bounds(sheet)
  if (maxC < 0) {
    return []
  }
  const ctx = {getRaw: (id: string) => sheet.dataState[id]}
  const aoa: Array<Array<string | number | null>> = []

  const hasHeader = Object.keys(sheet.colTitles).length > 0
  if (hasHeader) {
    const header: Array<string | number | null> = []
    for (let c = 0; c <= maxC; c++) {
      header.push(sheet.colTitles[c] || '')
    }
    aoa.push(header)
  }

  for (let r = 0; r <= maxR; r++) {
    const line: Array<string | number | null> = []
    for (let c = 0; c <= maxC; c++) {
      const raw = sheet.dataState[`${r}:${c}`]
      if (raw === undefined || raw === '') {
        line.push(null)
        continue
      }
      const txt = String(evaluateCell(`${r}:${c}`, ctx))
      line.push(NUMERIC.test(txt) ? Number(txt) : txt)
    }
    aoa.push(line)
  }
  return aoa
}

/** Имя листа для Excel: без запрещённых символов, не длиннее 31, уникальное. */
function safeSheetName(name: string, used: Set<string>): string {
  let base = (name || 'Лист').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Лист'
  let n = base
  let i = 2
  while (used.has(n.toLowerCase())) {
    const suffix = ` (${i++})`
    n = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(n.toLowerCase())
  return n
}

export async function exportXlsx(state: AppState): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  state.sheets.forEach(sheet => {
    const ws = XLSX.utils.aoa_to_sheet(sheetToAoa(sheet))
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheet.name, used))
  })
  const file = (state.title || 'Книга').replace(/[\\/?*[\]:]/g, ' ').trim() || 'Книга'
  XLSX.writeFile(wb, `${file}.xlsx`)
}
