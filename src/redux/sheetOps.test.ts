import {describe, expect, it} from 'vitest'
import {deleteAxis, insertAxis, moveRange, pasteRange} from '@/redux/sheetOps'
import {emptySheet} from '@/redux/initialState'
import type {SheetState} from '@/redux/types'

function fixture(): SheetState {
  // сетка 3x3, данные = "r:c", чтобы видеть сдвиг
  const s = emptySheet('Тест')
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      s.dataState[`${r}:${c}`] = `${r}-${c}`
      s.stylesState[`${r}:${c}`] = {color: `${r}${c}`}
    }
  }
  s.rowsCount = 3
  s.colsCount = 3
  s.rowState = {0: 10, 1: 20, 2: 30}
  s.colState = {0: 100, 1: 200, 2: 300}
  s.rowTitles = {0: 'r0', 1: 'r1', 2: 'r2'}
  s.colTitles = {0: 'c0', 1: 'c1', 2: 'c2'}
  return s
}

describe('deleteAxis: строки', () => {
  it('удаляет строку 1 и сдвигает нижние вверх', () => {
    const r = deleteAxis(fixture(), 'row', 1)
    expect(r.rowsCount).toBe(2)
    // строка 0 на месте
    expect(r.dataState['0:0']).toBe('0-0')
    // строка 2 уехала на место строки 1
    expect(r.dataState['1:0']).toBe('2-0')
    expect(r.dataState['1:2']).toBe('2-2')
    // строки с индексом 2 больше нет
    expect(r.dataState['2:0']).toBeUndefined()
  })

  it('сдвигает стили, размеры и заголовки строк', () => {
    const r = deleteAxis(fixture(), 'row', 1)
    expect(r.stylesState['1:0']).toEqual({color: '20'})
    expect(r.rowState).toEqual({0: 10, 1: 30})
    expect(r.rowTitles).toEqual({0: 'r0', 1: 'r2'})
  })

  it('столбцы не трогает при удалении строки', () => {
    const r = deleteAxis(fixture(), 'row', 0)
    expect(r.colState).toEqual({0: 100, 1: 200, 2: 300})
    expect(r.colsCount).toBe(3)
  })
})

describe('deleteAxis: столбцы', () => {
  it('удаляет столбец 0 и сдвигает правые влево', () => {
    const r = deleteAxis(fixture(), 'col', 0)
    expect(r.colsCount).toBe(2)
    expect(r.dataState['0:0']).toBe('0-1')
    expect(r.dataState['0:1']).toBe('0-2')
    expect(r.dataState['0:2']).toBeUndefined()
    expect(r.colState).toEqual({0: 200, 1: 300})
    expect(r.colTitles).toEqual({0: 'c1', 1: 'c2'})
  })
})

describe('insertAxis', () => {
  it('вставляет строку перед индексом 1 и сдвигает вниз', () => {
    const r = insertAxis(fixture(), 'row', 1)
    expect(r.rowsCount).toBe(4)
    expect(r.dataState['0:0']).toBe('0-0')
    // на месте новой строки 1 — пусто
    expect(r.dataState['1:0']).toBeUndefined()
    // старая строка 1 уехала на 2
    expect(r.dataState['2:0']).toBe('1-0')
    expect(r.dataState['3:0']).toBe('2-0')
    expect(r.rowTitles).toEqual({0: 'r0', 2: 'r1', 3: 'r2'})
  })

  it('вставляет столбец перед индексом 0', () => {
    const r = insertAxis(fixture(), 'col', 0)
    expect(r.colsCount).toBe(4)
    expect(r.dataState['0:0']).toBeUndefined()
    expect(r.dataState['0:1']).toBe('0-0')
    expect(r.colState).toEqual({1: 100, 2: 200, 3: 300})
  })
})

describe('коррекция диапазонов таблиц/графиков', () => {
  function withRange(): SheetState {
    const s = fixture()
    s.tables = [{id: 'a', name: 'T', range: {r1: 1, c1: 0, r2: 2, c2: 2}}]
    s.charts = [{id: 'b', type: 'bar', title: 'C', range: {r1: 0, c1: 1, r2: 0, c2: 2}}]
    return s
  }

  it('сжимает диапазон таблицы при удалении внутренней строки', () => {
    const r = deleteAxis(withRange(), 'row', 2)
    expect(r.tables[0].range).toEqual({r1: 1, c1: 0, r2: 1, c2: 2})
  })

  it('сдвигает диапазон при удалении строки выше него', () => {
    const r = deleteAxis(withRange(), 'row', 0)
    expect(r.tables[0].range).toEqual({r1: 0, c1: 0, r2: 1, c2: 2})
  })

  it('удаляет график, чей диапазон схлопнулся', () => {
    // график занимает только строку 0; удаляем строку 0 -> схлопывается
    const r = deleteAxis(withRange(), 'row', 0)
    expect(r.charts).toHaveLength(0)
  })

  it('расширяет диапазон при вставке строки внутрь', () => {
    const r = insertAxis(withRange(), 'row', 2)
    expect(r.tables[0].range).toEqual({r1: 1, c1: 0, r2: 3, c2: 2})
  })
})

describe('moveRange', () => {
  it('переносит данные и стили на смещение, очищая старое место', () => {
    const r = moveRange(fixture(), {r1: 0, c1: 0, r2: 0, c2: 0}, 2, 2)
    expect(r.dataState['0:0']).toBeUndefined()
    expect(r.dataState['2:2']).toBe('0-0')
    expect(r.stylesState['2:2']).toEqual({color: '00'})
    expect(r.stylesState['0:0']).toBeUndefined()
  })

  it('расширяет счётчики при переносе за нижний/правый край', () => {
    const r = moveRange(fixture(), {r1: 0, c1: 0, r2: 0, c2: 0}, 25, 30)
    expect(r.rowsCount).toBeGreaterThanOrEqual(26)
    expect(r.colsCount).toBeGreaterThanOrEqual(31)
  })

  it('no-op (тот же объект) при выходе за левый/верхний край', () => {
    const f = fixture()
    expect(moveRange(f, {r1: 0, c1: 0, r2: 1, c2: 1}, -1, 0)).toBe(f)
    expect(moveRange(f, {r1: 0, c1: 0, r2: 1, c2: 1}, 0, 0)).toBe(f)
  })

  it('корректно работает при пересечении старого и нового диапазона', () => {
    // двигаем блок 0:0..1:1 на (1,1) — пересекается со старым
    const r = moveRange(fixture(), {r1: 0, c1: 0, r2: 1, c2: 1}, 1, 1)
    expect(r.dataState['1:1']).toBe('0-0')
    expect(r.dataState['2:2']).toBe('1-1')
    expect(r.dataState['0:0']).toBeUndefined()
  })
})

describe('pasteRange', () => {
  it('вставляет блок ячеек начиная с (row, col)', () => {
    const r = pasteRange(emptySheet('X'), 1, 1, [
      [{value: 'a'}, {value: 'b'}],
      [{value: 'c'}, {value: 'd'}]
    ])
    expect(r.dataState['1:1']).toBe('a')
    expect(r.dataState['1:2']).toBe('b')
    expect(r.dataState['2:1']).toBe('c')
    expect(r.dataState['2:2']).toBe('d')
  })

  it('расширяет лист под вставку и переносит стили', () => {
    const r = pasteRange(emptySheet('X'), 30, 30, [[{value: 'z', style: {color: 'red'}}]])
    expect(r.rowsCount).toBe(31)
    expect(r.colsCount).toBe(31)
    expect(r.stylesState['30:30']).toEqual({color: 'red'})
  })

  it('пустое значение очищает ячейку', () => {
    const base = pasteRange(emptySheet('X'), 0, 0, [[{value: 'x'}]])
    const cleared = pasteRange(base, 0, 0, [[{value: ''}]])
    expect(cleared.dataState['0:0']).toBeUndefined()
  })
})
