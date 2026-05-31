// Рендер графиков в SVG-строку без внешних зависимостей.
// Чистые функции: на входе подписи + числа, на выходе разметка <svg>.

import type {ChartType} from '@/redux/types'

export interface ChartData {
  labels: string[]
  values: number[]
}

const PALETTE = [
  '#3c74ff', '#ff6b6b', '#51cf66', '#ffd43b', '#845ef7',
  '#22b8cf', '#ff922b', '#f06595', '#94d82d', '#5c7cfa'
]

/** Округление до 2 знаков без хвостов вида .00. */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function escapeText(s: string): string {
  return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
}

/** Короткая подпись значения для осей. */
function fmt(n: number): string {
  if (!isFinite(n)) {
    return '0'
  }
  const a = Math.abs(n)
  if (a >= 1000) {
    return r2(n / 1000) + 'k'
  }
  return String(r2(n))
}

const W = 360
const H = 220
const PAD = {top: 16, right: 14, bottom: 26, left: 40}

function plotBox() {
  return {
    x: PAD.left,
    y: PAD.top,
    w: W - PAD.left - PAD.right,
    h: H - PAD.top - PAD.bottom
  }
}

function axes(box: ReturnType<typeof plotBox>): string {
  return `
    <line x1="${box.x}" y1="${box.y}" x2="${box.x}" y2="${box.y + box.h}"
          stroke="#ced4da" stroke-width="1"/>
    <line x1="${box.x}" y1="${box.y + box.h}" x2="${box.x + box.w}"
          y2="${box.y + box.h}" stroke="#ced4da" stroke-width="1"/>
  `
}

/** Подписи по оси Y: 0 и максимум. */
function yTicks(box: ReturnType<typeof plotBox>, max: number): string {
  return `
    <text x="${box.x - 4}" y="${box.y + 4}" text-anchor="end"
          font-size="9" fill="#868e96">${escapeText(fmt(max))}</text>
    <text x="${box.x - 4}" y="${box.y + box.h}" text-anchor="end"
          font-size="9" fill="#868e96">0</text>
  `
}

function xLabels(
    box: ReturnType<typeof plotBox>,
    labels: string[],
    step: number,
    offset: number
): string {
  // показываем не больше ~8 подписей, чтобы не слипались
  const skip = Math.ceil(labels.length / 8)
  return labels
      .map((label, i) => {
        if (i % skip !== 0) {
          return ''
        }
        const x = box.x + offset + step * i
        const text = escapeText(label.length > 6 ? label.slice(0, 6) : label)
        return `<text x="${r2(x)}" y="${box.y + box.h + 14}"
          text-anchor="middle" font-size="9" fill="#868e96">${text}</text>`
      })
      .join('')
}

function renderBar(data: ChartData): string {
  const box = plotBox()
  const n = data.values.length
  const max = Math.max(1, ...data.values.map(v => (v > 0 ? v : 0)))
  const slot = box.w / n
  const barW = Math.max(2, slot * 0.7)
  const bars = data.values
      .map((v, i) => {
        const h = (Math.max(0, v) / max) * box.h
        const x = box.x + slot * i + (slot - barW) / 2
        const y = box.y + box.h - h
        const color = PALETTE[i % PALETTE.length]
        return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(barW)}"
          height="${r2(h)}" fill="${color}" rx="2">
          <title>${escapeText(data.labels[i] || '')}: ${v}</title></rect>`
      })
      .join('')
  return `${axes(box)}${yTicks(box, max)}${bars}` +
    xLabels(box, data.labels, slot, slot / 2)
}

function renderLine(data: ChartData): string {
  const box = plotBox()
  const n = data.values.length
  const max = Math.max(1, ...data.values.map(v => (v > 0 ? v : 0)))
  const step = n > 1 ? box.w / (n - 1) : 0
  const pts = data.values.map((v, i) => {
    const x = box.x + step * i
    const y = box.y + box.h - (Math.max(0, v) / max) * box.h
    return {x, y, v, i}
  })
  const poly = pts.map(p => `${r2(p.x)},${r2(p.y)}`).join(' ')
  const dots = pts
      .map(p => `<circle cx="${r2(p.x)}" cy="${r2(p.y)}" r="3"
        fill="${PALETTE[0]}"><title>${escapeText(data.labels[p.i] || '')}: ${p.v}</title></circle>`)
      .join('')
  return `${axes(box)}${yTicks(box, max)}` +
    `<polyline points="${poly}" fill="none" stroke="${PALETTE[0]}"
      stroke-width="2" stroke-linejoin="round"/>${dots}` +
    xLabels(box, data.labels, step, 0)
}

function arcPath(
    cx: number, cy: number, rad: number, a0: number, a1: number
): string {
  const x1 = cx + rad * Math.cos(a0)
  const y1 = cy + rad * Math.sin(a0)
  const x2 = cx + rad * Math.cos(a1)
  const y2 = cy + rad * Math.sin(a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${r2(cx)},${r2(cy)} L${r2(x1)},${r2(y1)} ` +
    `A${rad},${rad} 0 ${large} 1 ${r2(x2)},${r2(y2)} Z`
}

function renderPie(data: ChartData): string {
  const cx = W / 2
  const cy = H / 2
  const rad = Math.min(W, H) / 2 - 24
  const vals = data.values.map(v => (v > 0 ? v : 0))
  const total = vals.reduce((a, b) => a + b, 0)
  if (total <= 0) {
    return `<text x="${cx}" y="${cy}" text-anchor="middle"
      font-size="11" fill="#868e96">нет данных</text>`
  }
  // один ненулевой сегмент = полный круг
  const nonZero = vals.filter(v => v > 0).length
  if (nonZero === 1) {
    const idx = vals.findIndex(v => v > 0)
    return `<circle cx="${cx}" cy="${cy}" r="${rad}"
      fill="${PALETTE[idx % PALETTE.length]}"/>`
  }
  let angle = -Math.PI / 2
  return vals
      .map((v, i) => {
        if (v <= 0) {
          return ''
        }
        const sweep = (v / total) * Math.PI * 2
        const path = arcPath(cx, cy, rad, angle, angle + sweep)
        angle += sweep
        const pct = Math.round((v / total) * 100)
        return `<path d="${path}" fill="${PALETTE[i % PALETTE.length]}"
          stroke="#fff" stroke-width="1">
          <title>${escapeText(data.labels[i] || '')}: ${v} (${pct}%)</title></path>`
      })
      .join('')
}

/** Главная точка входа: SVG-строка для графика заданного типа. */
export function renderChartSvg(type: ChartType, data: ChartData): string {
  let body: string
  if (type === 'pie') {
    body = renderPie(data)
  } else if (type === 'line') {
    body = renderLine(data)
  } else {
    body = renderBar(data)
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg" class="chart-svg">${body}</svg>`
}
