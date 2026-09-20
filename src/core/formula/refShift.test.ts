import {describe, expect, it} from 'vitest'
import {shiftFormula} from '@core/formula/refShift'
import {deleteAxis, insertAxis} from '@/redux/sheetOps'
import {emptySheet} from '@/redux/initialState'

describe('shiftFormula', () => {
  it('вставка строки сдвигает ссылки ниже точки вставки', () => {
    expect(shiftFormula('=A1+A5', 'row', 'insert', 2)).toBe('=A1+A6')
    expect(shiftFormula('=$B$3*2', 'row', 'insert', 0)).toBe('=$B$4*2')
  })
  it('диапазон растягивается, если вставка внутри', () => {
    expect(shiftFormula('=SUM(A1:A5)', 'row', 'insert', 2)).toBe('=SUM(A1:A6)')
    expect(shiftFormula('=SUM(A1:A5)', 'row', 'insert', 0)).toBe('=SUM(A2:A6)')
  })
  it('удаление: ссылка на удалённую -> #REF!, диапазон сжимается', () => {
    expect(shiftFormula('=A2+A3', 'row', 'delete', 1)).toBe('=#REF!+A2')
    expect(shiftFormula('=SUM(A1:A5)', 'row', 'delete', 2)).toBe('=SUM(A1:A4)')
    expect(shiftFormula('=SUM(A2:A2)', 'row', 'delete', 1)).toBe('=SUM(#REF!)')
  })
  it('столбцы, строки-литералы и не-формулы не портит', () => {
    expect(shiftFormula('=B1&"A9"', 'col', 'insert', 0)).toBe('=C1&"A9"')
    expect(shiftFormula('A9', 'row', 'insert', 0)).toBe('A9')
    expect(shiftFormula('=LOG10(A1)', 'row', 'insert', 0)).toBe('=LOG10(A2)')
  })
  it('интеграция: вставка строки перед данными двигает и формулу и ссылку', () => {
    const s = emptySheet()
    s.dataState = {'0:0': '1', '1:0': '2', '2:0': '=A1+A2'}
    const r = insertAxis(s, 'row', 0)
    expect(r.dataState['3:0']).toBe('=A2+A3')
    expect(deleteAxis(s, 'row', 0).dataState['1:0']).toBe('=#REF!+A1')
  })
})

import {translateFormula} from '@core/formula/refShift'
describe('translateFormula', () => {
  it('относительные едут, абсолютные стоят', () => {
    expect(translateFormula('=A1+$B$1+B$2', 2, 1)).toBe('=B3+$B$1+C$2')
    expect(translateFormula('=SUM(A1:A3)', 0, 1)).toBe('=SUM(B1:B3)')
    expect(translateFormula('=A1', -1, 0)).toBe('=#REF!')
    expect(translateFormula('текст A1', 1, 1)).toBe('текст A1')
  })
})

import {evaluate} from '@core/formula'
describe('IF ленивый', () => {
  const ctx = {getRaw: (id: string) => ({'0:0': '0', '1:0': '5'} as Record<string, string>)[id]}
  it('ошибка в невыбранной ветке игнорируется', () => {
    expect(evaluate('IF(A1=0;"нет";A2/A1)', ctx)).toBe('нет')
    expect(() => evaluate('IF(A1=1;"нет";A2/A1)', ctx)).toThrow()
    expect(evaluate('IF(A2>1;SUM(A1:A2);1/0)', ctx)).toBe(5)
  })
})
