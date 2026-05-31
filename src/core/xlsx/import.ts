import type {CellObject, WorkSheet} from 'xlsx'
import {emptySheet} from '@/redux/initialState'
import {defaultCols, defaultRows} from '@/constants'
import type {SheetState} from '@/redux/types'

/** Отображаемое значение ячейки xlsx: форматированный текст .w, иначе сырое .v. */
function formatCell(cell: CellObject): string {
  if (cell.w != null) {
    return cell.w
  }
  if (cell.v == null) {
    return ''
  }
  if (cell.v instanceof Date) {
    return cell.v.toLocaleDateString()
  }
  return String(cell.v)
}

/**
 * Парсит .xlsx/.xls/.csv в документ: все листы файла -> вкладки.
 * Первая строка каждого листа становится названиями колонок (colTitles),
 * остальные строки — данными.
 */
export async function parseXlsxFile(
    file: File
): Promise<{title: string; sheets: SheetState[]}> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, {type: 'array'})

  const sheets: SheetState[] = wb.SheetNames.map(name => {
    const ws = wb.Sheets[name] as WorkSheet
    const sheet = emptySheet(name)
    const ref = ws['!ref']
    if (!ref) {
      return sheet
    }
    const range = XLSX.utils.decode_range(ref)
    let maxRow = -1
    let maxCol = 0
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({r, c})] as CellObject | undefined
        if (!cell || cell.v == null) {
          continue
        }
        const val = formatCell(cell)
        if (val === '') {
          continue
        }
        const col = c - range.s.c
        if (col > maxCol) {
          maxCol = col
        }
        if (r === range.s.r) {
          // первая строка -> заголовки колонок
          sheet.colTitles[col] = val
        } else {
          const row = r - range.s.r - 1
          sheet.dataState[`${row}:${col}`] = val
          if (row > maxRow) {
            maxRow = row
          }
        }
      }
    }
    sheet.rowsCount = Math.max(maxRow + 1, defaultRows)
    sheet.colsCount = Math.max(maxCol + 1, defaultCols)
    return sheet
  })

  const title = file.name.replace(/\.[^.]+$/, '') || 'Импорт'
  return {title, sheets: sheets.length ? sheets : [emptySheet()]}
}
