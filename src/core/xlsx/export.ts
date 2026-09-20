// Экспорт документа в .xlsx через SheetJS (ленивая загрузка — не в основном бандле).
// Сетка выгружается 1:1 (A1 таблицы = A1 файла), формулы — живыми, с кэшем значения.

import {evaluateCell} from '@core/formula'
import type {AppState, SheetState} from '@/redux/types'
import type {CellObject, ColInfo, RowInfo, WorkSheet} from 'xlsx-js-style'
import {loadXlsx} from '@core/xlsx/lib'
import type {XlsxLib} from '@core/xlsx/lib'
import {toXlsxStyle} from '@core/xlsx/styles'

const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?(e[+-]?\d+)?$/i
const PERCENT = /^-?(0|[1-9]\d*)(\.\d+)?%$/
const DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/

const ERROR_CODES: Record<string, number> = {
  '#DIV/0!': 0x07, '#REF!': 0x17, '#NAME?': 0x1D, '#VALUE!': 0x0F
}

/** Границы заполненной области листа. */
function bounds(sheet: SheetState): {maxR: number; maxC: number} {
  let maxR = -1
  let maxC = -1
  for (const id of Object.keys(sheet.dataState)) {
    if (sheet.dataState[id] === '') {
      continue
    }
    const [r, c] = id.split(':').map(Number)
    if (r > maxR) maxR = r
    if (c > maxC) maxC = c
  }
  // ячейки только со стилем (заливка и т.п.) тоже должны попасть в файл
  for (const id of Object.keys(sheet.stylesState)) {
    if (toXlsxStyle(sheet.stylesState[id])) {
      const [r, c] = id.split(':').map(Number)
      if (r > maxR) maxR = r
      if (c > maxC) maxC = c
    }
  }
  return {maxR, maxC}
}

/** Наш синтаксис формулы -> файловый формат: ';' -> ',', имена в верхний регистр. */
export function toExcelFormula(body: string): string {
  let out = ''
  let inStr = false
  let word = ''
  const flush = () => {
    out += word.toUpperCase()
    word = ''
  }
  for (const ch of body) {
    if (inStr) {
      out += ch
      inStr = ch !== '"'
    } else if (ch === '"') {
      flush()
      out += ch
      inStr = true
    } else if (/[A-Za-z0-9_.$]/.test(ch)) {
      word += ch
    } else {
      flush()
      out += ch === ';' ? ',' : ch
    }
  }
  flush()
  return out
}

function serialDate(d: number, m: number, y: number): number | null {
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null
  }
  return (date.getTime() - Date.UTC(1899, 11, 30)) / 86400000
}

/** Типизированная ячейка xlsx по тексту (число/процент/дата/текст). */
function valueCell(text: string): CellObject {
  if (NUMBER.test(text)) {
    return {t: 'n', v: Number(text)}
  }
  if (PERCENT.test(text)) {
    return {t: 'n', v: Number(text.slice(0, -1)) / 100, z: '0%'}
  }
  const m = DATE.exec(text)
  if (m) {
    const serial = serialDate(+m[1], +m[2], +m[3])
    if (serial !== null) {
      return {t: 'n', v: serial, z: 'dd.mm.yyyy'}
    }
  }
  return {t: 's', v: text}
}

function toCell(raw: string, id: string, ctx: {getRaw(id: string): string | undefined}): CellObject | null {
  if (raw === '') {
    return null
  }
  if (raw.startsWith('=')) {
    const body = raw.slice(1)
    if (body.trim() === '') {
      return null
    }
    const shown = evaluateCell(id, ctx)
    const f = toExcelFormula(body)
    if (shown.startsWith('#')) {
      return {t: 'e', v: ERROR_CODES[shown] ?? 0x0F, w: shown, f}
    }
    const cell = shown === '' ? {t: 's', v: ''} as CellObject : valueCell(shown)
    return {...cell, f}
  }
  return valueCell(raw)
}

function sheetToWorksheet(sheet: SheetState, XLSX: XlsxLib): WorkSheet {
  const {maxR, maxC} = bounds(sheet)
  const ws: WorkSheet = {}
  if (maxC >= 0) {
    const ctx = {getRaw: (id: string) => sheet.dataState[id]}
    for (let r = 0; r <= maxR; r++) {
      for (let c = 0; c <= maxC; c++) {
        const id = `${r}:${c}`
        let cell = toCell(sheet.dataState[id] ?? '', id, ctx)
        const style = toXlsxStyle(sheet.stylesState[id])
        if (style) {
          cell = {...(cell ?? {t: 's', v: ''}), s: style}
        }
        if (cell) {
          ws[XLSX.utils.encode_cell({r, c})] = cell
        }
      }
    }
    ws['!ref'] = XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: maxR, c: maxC}})
  }
  if ((sheet.merges || []).length) {
    ws['!merges'] = sheet.merges.map(m => ({s: {r: m.r1, c: m.c1}, e: {r: m.r2, c: m.c2}}))
    // Excel считает объединение частью листа — расширяем ref, если оно выходит за данные
    const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
    for (const m of sheet.merges) {
      ref.e.r = Math.max(ref.e.r, m.r2)
      ref.e.c = Math.max(ref.e.c, m.c2)
    }
    ws['!ref'] = XLSX.utils.encode_range(ref)
  }
  // ширины/высоты, которые пользователь менял мышкой
  const colIdx = Object.keys(sheet.colState).map(Number)
  if (colIdx.length) {
    const cols: ColInfo[] = Array.from({length: Math.max(...colIdx) + 1}, () => ({}))
    colIdx.forEach(c => {
      cols[c] = {wpx: sheet.colState[c]}
    })
    ws['!cols'] = cols
  }
  const rowIdx = Object.keys(sheet.rowState).map(Number)
  if (rowIdx.length) {
    const rows: RowInfo[] = Array.from({length: Math.max(...rowIdx) + 1}, () => ({}))
    rowIdx.forEach(r => {
      rows[r] = {hpx: sheet.rowState[r]}
    })
    ws['!rows'] = rows
  }
  return ws
}

/** Имя листа для Excel: без запрещённых символов, не длиннее 31, уникальное. */
function safeSheetName(name: string, used: Set<string>): string {
  const base = (name || 'Лист').replace(/[\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Лист'
  let n = base
  let i = 2
  while (used.has(n.toLowerCase())) {
    const suffix = ` (${i++})`
    n = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(n.toLowerCase())
  return n
}

/** Собирает книгу SheetJS из документа (без скачивания — удобно для тестов). */
export async function buildWorkbook(state: AppState) {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  state.sheets.forEach(sheet => {
    XLSX.utils.book_append_sheet(
        wb, sheetToWorksheet(sheet, XLSX), safeSheetName(sheet.name, used))
  })
  return {XLSX, wb}
}

export async function exportXlsx(state: AppState): Promise<void> {
  const {XLSX, wb} = await buildWorkbook(state)
  const file = (state.title || 'Книга').replace(/[\/:*?"<>|]/g, ' ').trim() || 'Книга'
  XLSX.writeFile(wb, `${file}.xlsx`)
}
