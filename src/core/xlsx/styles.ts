// Перевод стилей ячейки между нашей моделью (CSS-строки) и форматом xlsx.

import type {CellStyle} from 'xlsx-js-style'
import type {CellStyles} from '@/redux/types'

const NAMED: Record<string, string> = {
  black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF',
  yellow: 'FFFF00', orange: 'FFA500', gray: '808080', grey: '808080', purple: '800080'
}

/** CSS-цвет (#rgb, #rrggbb, rgb(), имя) -> "RRGGBB" или null. */
export function cssToRgb(color: string | undefined): string | null {
  if (!color) {
    return null
  }
  const c = color.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map(x => x + x).join('') : hex[1]
    return h.toUpperCase()
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c)
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
        .map(n => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
        .join('').toUpperCase()
  }
  return NAMED[c] ?? null
}

/** Стиль ячейки -> стиль xlsx, либо undefined, если все значения по умолчанию. */
export function toXlsxStyle(st: CellStyles | undefined): CellStyle | undefined {
  if (!st) {
    return undefined
  }
  const style: CellStyle = {}
  const font: NonNullable<CellStyle['font']> = {}
  if (st.fontWeight === 'bold') font.bold = true
  if (st.fontStyle === 'italic') font.italic = true
  if (st.textDecoration === 'underline') font.underline = true
  const color = cssToRgb(st.color)
  if (color) font.color = {rgb: color}
  const size = parseFloat(st.fontSize || '')
  if (size > 0) font.sz = Math.round(size * 0.75) // px -> pt
  if (Object.keys(font).length) style.font = font
  const bg = cssToRgb(st.backgroundColor)
  if (bg) style.fill = {patternType: 'solid', fgColor: {rgb: bg}}
  if (st.textAlign === 'center' || st.textAlign === 'right') {
    style.alignment = {horizontal: st.textAlign}
  }
  return Object.keys(style).length ? style : undefined
}

/**
 * Стиль из прочитанной ячейки. Бесплатный SheetJS при чтении отдаёт только заливку
 * (`s.fgColor`), поэтому импортируем цвет фона.
 */
export function fromXlsxStyle(s: unknown): CellStyles | undefined {
  const fill = s as {patternType?: string; fgColor?: {rgb?: string}} | undefined
  const rgb = fill?.patternType === 'solid' ? fill.fgColor?.rgb : undefined
  if (!rgb || !/^[0-9a-f]{6,8}$/i.test(rgb)) {
    return undefined
  }
  const hex = rgb.slice(-6).toUpperCase()
  return hex === 'FFFFFF' ? undefined : {backgroundColor: `#${hex}`}
}
