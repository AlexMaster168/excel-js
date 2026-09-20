import type {CellObject, WorkSheet} from 'xlsx-js-style'
import {loadXlsx} from '@core/xlsx/lib'
import type {XlsxLib} from '@core/xlsx/lib'
import {fromXlsxStyle} from '@core/xlsx/styles'
import {emptySheet} from '@/redux/initialState'
import {defaultCols, defaultRows} from '@/constants'
import {evaluateCell, FUNCTIONS} from '@core/formula'
import type {SheetState} from '@/redux/types'
import {decodeText, parseCsv} from '@core/xlsx/csv'

// Предохранитель: DOM-таблица на десятки тысяч ячеек вешает браузер.
export const MAX_ROWS = 3000
export const MAX_COLS = 100

export interface ImportResult {
  title: string
  sheets: SheetState[]
  warnings: string[]
}

const pad = (n: number) => String(n).padStart(2, '0')

// коды ошибок Excel (.v при t:'e') -> текст
const ERRORS: Record<number, string> = {
  0x00: '#NULL!', 0x07: '#DIV/0!', 0x0F: '#VALUE!',
  0x17: '#REF!', 0x1D: '#NAME?', 0x24: '#NUM!', 0x2A: '#N/A'
}

/** Формула Excel -> наш синтаксис, либо null, если движок её не потянет. */
export function convertFormula(f: string): string | null {
  // ссылки на другие листы, внешние книги, массивы, структурные ссылки
  if (/[![\]{}@]/.test(f.replace(/"[^"]*"/g, '""'))) {
    return null
  }
  const body = f.replace(/^=/, '')
  const names = body.replace(/"[^"]*"/g, '""').match(/[A-Za-z_][A-Za-z0-9_.]*(?=\()/g) || []
  if (names.some(n => !FUNCTIONS[n.toUpperCase()])) {
    return null
  }
  return '=' + body
}

/** Отображаемое значение вычисленной (не формульной) ячейки. */
function cellText(cell: CellObject, XLSX: XlsxLib): string {
  switch (cell.t) {
    case 'n': {
      const v = cell.v as number
      if (cell.z && XLSX.SSF.is_date(String(cell.z))) {
        const d = XLSX.SSF.parse_date_code(v)
        if (d) {
          const date = `${pad(d.d)}.${pad(d.m)}.${d.y}`
          return d.H || d.M ? `${date} ${pad(d.H)}:${pad(d.M)}` : date
        }
      }
      return String(v)
    }
    case 'b':
      return cell.v ? 'TRUE' : 'FALSE'
    case 'e':
      return typeof cell.v === 'number' ? ERRORS[cell.v] ?? '#ERROR!' : String(cell.v)
    case 'd':
      return cell.v instanceof Date
        ? `${pad(cell.v.getDate())}.${pad(cell.v.getMonth() + 1)}.${cell.v.getFullYear()}`
        : String(cell.v)
    default:
      return cell.v == null ? '' : String(cell.v)
  }
}

/** Приводит cachedValue и результат нашего движка к сравнимому виду. */
function sameValue(a: string, b: string): boolean {
  if (a === b) {
    return true
  }
  const x = Number(a)
  const y = Number(b)
  return a.trim() !== '' && b.trim() !== '' && !Number.isNaN(x) && !Number.isNaN(y) &&
    Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y))
}

/**
 * Формулы, которые наш движок считает иначе, чем Excel (или не знает), заменяем
 * закэшированным значением из файла — лучше верные данные, чем «живая» неверная формула.
 */
function verifyFormulas(sheet: SheetState, cached: Record<string, string>): void {
  const ctx = {getRaw: (id: string) => sheet.dataState[id]}
  for (let pass = 0; pass < 3; pass++) {
    let changed = false
    for (const id of Object.keys(cached)) {
      if (!sheet.dataState[id].startsWith('=')) {
        continue
      }
      if (!sameValue(evaluateCell(id, ctx), cached[id])) {
        sheet.dataState[id] = cached[id]
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }
}

function applySize(sheet: SheetState, ws: WorkSheet): void {
  const cols = ws['!cols'] || []
  cols.forEach((col, c) => {
    if (col && !col.hidden && c < MAX_COLS) {
      const px = col.wpx ?? (col.wch ? Math.round(col.wch * 7 + 5) : 0)
      if (px > 10) {
        sheet.colState[c] = Math.min(px, 800)
      }
    }
  })
  const rows = ws['!rows'] || []
  rows.forEach((row, r) => {
    if (row && !row.hidden && r < MAX_ROWS) {
      const px = row.hpx ?? (row.hpt ? Math.round(row.hpt * 4 / 3) : 0)
      if (px > 10) {
        sheet.rowState[r] = Math.min(px, 500)
      }
    }
  })
}

function sheetFromWorksheet(
    name: string,
    ws: WorkSheet,
    XLSX: XlsxLib,
    warnings: string[]
): SheetState {
  const sheet = emptySheet(name)
  const ref = ws['!ref']
  if (!ref) {
    return sheet
  }
  const range = XLSX.utils.decode_range(ref)
  const cached: Record<string, string> = {}
  let maxRow = -1
  let maxCol = -1
  // позиции сохраняем абсолютные: A1 файла == A1 таблицы
  for (let r = range.s.r; r <= Math.min(range.e.r, MAX_ROWS - 1); r++) {
    for (let c = range.s.c; c <= Math.min(range.e.c, MAX_COLS - 1); c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})] as CellObject | undefined
      if (!cell) {
        continue
      }
      const value = cellText(cell, XLSX)
      const id = `${r}:${c}`
      const style = fromXlsxStyle(cell.s)
      if (style) {
        sheet.stylesState[id] = style
        maxRow = Math.max(maxRow, r)
        maxCol = Math.max(maxCol, c)
      }
      if (value === '' && !cell.f) {
        continue
      }
      const formula = cell.f ? convertFormula(cell.f) : null
      if (formula) {
        sheet.dataState[id] = formula
        cached[id] = value
      } else {
        sheet.dataState[id] = value
      }
      maxRow = Math.max(maxRow, r)
      maxCol = Math.max(maxCol, c)
    }
  }
  verifyFormulas(sheet, cached)
  applySize(sheet, ws)
  if (range.e.r >= MAX_ROWS || range.e.c >= MAX_COLS) {
    warnings.push(`Лист «${name}» обрезан до ${MAX_ROWS} строк и ${MAX_COLS} столбцов`)
  }
  for (const m of ws['!merges'] || []) {
    if (m.s.r >= MAX_ROWS || m.s.c >= MAX_COLS) {
      continue
    }
    const merge = {
      r1: m.s.r,
      c1: m.s.c,
      r2: Math.min(m.e.r, MAX_ROWS - 1),
      c2: Math.min(m.e.c, MAX_COLS - 1)
    }
    if (merge.r1 === merge.r2 && merge.c1 === merge.c2) {
      continue
    }
    sheet.merges.push(merge)
    // как в Excel: значение хранит только левая-верхняя ячейка
    for (let r = merge.r1; r <= merge.r2; r++) {
      for (let c = merge.c1; c <= merge.c2; c++) {
        if (r !== merge.r1 || c !== merge.c1) {
          delete sheet.dataState[`${r}:${c}`]
        }
      }
    }
    maxRow = Math.max(maxRow, merge.r2)
    maxCol = Math.max(maxCol, merge.c2)
  }
  sheet.rowsCount = Math.max(maxRow + 1, defaultRows)
  sheet.colsCount = Math.max(maxCol + 1, defaultCols)
  return sheet
}

function sheetFromCsv(name: string, rows: string[][], warnings: string[]): SheetState {
  const sheet = emptySheet(name)
  let maxCol = -1
  rows.slice(0, MAX_ROWS).forEach((line, r) => {
    line.slice(0, MAX_COLS).forEach((value, c) => {
      if (value !== '') {
        sheet.dataState[`${r}:${c}`] = value
        maxCol = Math.max(maxCol, c)
      }
    })
  })
  if (rows.length > MAX_ROWS) {
    warnings.push(`CSV обрезан до ${MAX_ROWS} строк`)
  }
  sheet.rowsCount = Math.max(Math.min(rows.length, MAX_ROWS), defaultRows)
  sheet.colsCount = Math.max(maxCol + 1, defaultCols)
  return sheet
}

/**
 * Парсит .xlsx/.xls/.csv в документ: каждый лист файла -> вкладка.
 * Сетка переносится 1:1 (A1 файла = A1 таблицы), формулы сохраняются, если движок
 * их поддерживает и считает так же, как Excel.
 */
export async function parseXlsxFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const warnings: string[] = []
  const title = file.name.replace(/\.[^.]+$/, '') || 'Импорт'

  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const rows = parseCsv(decodeText(buffer))
    return {title, sheets: [sheetFromCsv(title, rows, warnings)], warnings}
  }

  const XLSX = await loadXlsx()
  const wb = XLSX.read(buffer, {type: 'array', cellFormula: true, cellNF: true, cellStyles: true})
  const sheets = wb.SheetNames.map(name =>
    sheetFromWorksheet(name, wb.Sheets[name] as WorkSheet, XLSX, warnings))
  return {title, sheets: sheets.length ? sheets : [emptySheet()], warnings}
}
