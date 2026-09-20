// Свой разбор CSV: SheetJS "умничает" (1,5 -> 15, 01 -> 1), а нам нужен сырой текст.

/** Декодирует байты: UTF-8 (с BOM или без), при ошибке — windows-1251 (Excel RU). */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(buffer).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1251').decode(buffer)
  }
}

/** Разделитель по первой непустой строке: ; , или tab (вне кавычек). */
export function detectDelimiter(text: string): string {
  const sep = /^sep=(.)\r?\n/.exec(text)
  if (sep) {
    return sep[1]
  }
  const counts: Record<string, number> = {';': 0, ',': 0, '\t': 0}
  let inQuotes = false
  for (const ch of text) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (!inQuotes) {
      if (ch === '\n') {
        if (Object.values(counts).some(n => n > 0)) {
          break
        }
      } else if (ch in counts) {
        counts[ch]++
      }
    }
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? best[0] : ','
}

/** Разбор CSV (RFC 4180: кавычки, "" внутри, переводы строк в полях). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^sep=.\r?\n/, '')
  const delim = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') {
        i++
      }
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  // десятичная запятая ("1,5") при разделителе ; или tab -> точка
  if (delim !== ',') {
    return rows.map(r => r.map(v => (/^-?\d+,\d+$/.test(v) ? v.replace(',', '.') : v)))
  }
  return rows
}
