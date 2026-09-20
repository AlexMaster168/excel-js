import {describe, expect, it} from 'vitest'
import {chartDataFromRange} from '@core/chart/data'
import {emptySheet} from '@/redux/initialState'

describe('chartDataFromRange', () => {
  const sheet = emptySheet()
  sheet.dataState = {
    '0:0': 'Товар', '0:1': 'Итого',
    '1:0': 'Яблоко', '1:1': '10',
    '2:0': 'Груша', '2:1': '20',
    '3:0': 'Слива', '3:1': '30'
  }
  it('шапка с текстом вместо числа в график не попадает', () => {
    expect(chartDataFromRange(sheet, {r1: 0, c1: 0, r2: 3, c2: 1}))
        .toEqual({labels: ['Яблоко', 'Груша', 'Слива'], values: [10, 20, 30]})
  })
  it('без шапки берёт все строки', () => {
    expect(chartDataFromRange(sheet, {r1: 1, c1: 0, r2: 3, c2: 1}).values).toEqual([10, 20, 30])
  })
})
