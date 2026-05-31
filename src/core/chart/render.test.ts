import {describe, expect, it} from 'vitest'
import {renderChartSvg} from '@core/chart/render'

const data = {labels: ['A', 'B', 'C'], values: [10, 20, 30]}

function count(svg: string, tag: string): number {
  return (svg.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length
}

describe('renderChartSvg', () => {
  it('всегда оборачивает в <svg> с viewBox', () => {
    const svg = renderChartSvg('bar', data)
    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox="0 0 360 220"')
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('bar: по одному <rect> на значение', () => {
    expect(count(renderChartSvg('bar', data), 'rect')).toBe(3)
  })

  it('line: одна polyline и по точке на значение', () => {
    const svg = renderChartSvg('line', data)
    expect(count(svg, 'polyline')).toBe(1)
    expect(count(svg, 'circle')).toBe(3)
  })

  it('pie: по сектору на ненулевое значение', () => {
    expect(count(renderChartSvg('pie', data), 'path')).toBe(3)
  })

  it('pie: один ненулевой сегмент рисуется кругом', () => {
    const svg = renderChartSvg('pie', {labels: ['X', 'Y'], values: [0, 5]})
    expect(count(svg, 'circle')).toBe(1)
    expect(count(svg, 'path')).toBe(0)
  })

  it('pie: пустые данные дают заглушку', () => {
    const svg = renderChartSvg('pie', {labels: ['X'], values: [0]})
    expect(svg).toContain('нет данных')
  })

  it('bar: не падает на отрицательных и нулях', () => {
    const svg = renderChartSvg('bar', {labels: ['A', 'B'], values: [-5, 0]})
    expect(count(svg, 'rect')).toBe(2)
    expect(svg).toContain('<svg')
  })
})
