import {describe, expect, it} from 'vitest'
import {buildWorkbook, toExcelFormula} from '@core/xlsx/export'
import {convertFormula, parseXlsxFile} from '@core/xlsx/import'
import {parseCsv} from '@core/xlsx/csv'
import {emptySheet} from '@/redux/initialState'
import type {AppState} from '@/redux/types'

function doc(data: Record<string, string>): AppState {
  const sheet = emptySheet('Данные')
  sheet.dataState = data
  return {
    title: 'T', openedDate: '', currentText: '', currentStyles: {},
    activeSheet: 0, sheets: [sheet]
  }
}

async function roundtrip(state: AppState) {
  const {XLSX, wb} = await buildWorkbook(state)
  const buf = XLSX.write(wb, {type: 'array', bookType: 'xlsx'}) as ArrayBuffer
  return parseXlsxFile(new File([buf], 'book.xlsx'))
}

describe('xlsx roundtrip', () => {
  it('сохраняет позиции (A1 остаётся A1), без заголовков-сдвига', async () => {
    const res = await roundtrip(doc({'0:0': 'Имя', '1:0': 'Аня', '1:1': '5', '2:2': 'x'}))
    expect(res.sheets[0].dataState).toEqual({'0:0': 'Имя', '1:0': 'Аня', '1:1': '5', '2:2': 'x'})
    expect(res.sheets[0].colTitles).toEqual({})
  })

  it('формулы выгружаются живыми и возвращаются формулами', async () => {
    const res = await roundtrip(doc({'0:0': '2', '1:0': '3', '2:0': '=sum(a1:a2)'}))
    expect(res.sheets[0].dataState['2:0']).toBe('=SUM(A1:A2)')
  })

  it('не портит строки вроде 007 и сохраняет даты', async () => {
    const res = await roundtrip(doc({'0:0': '007', '0:1': '05.01.2024', '0:2': '15%'}))
    expect(res.sheets[0].dataState['0:0']).toBe('007')
    expect(res.sheets[0].dataState['0:1']).toBe('05.01.2024')
    expect(res.sheets[0].dataState['0:2']).toBe('0.15')
  })

  it('объединённые ячейки переживают круг, значение только у главной', async () => {
    const state = doc({'0:0': 'Шапка'})
    state.sheets[0].merges = [{r1: 0, c1: 0, r2: 1, c2: 2}]
    const res = await roundtrip(state)
    expect(res.sheets[0].merges).toEqual([{r1: 0, c1: 0, r2: 1, c2: 2}])
    expect(res.sheets[0].dataState).toEqual({'0:0': 'Шапка'})
  })

  it('стили: жирный/цвет/заливка пишутся, заливка читается', async () => {
    const state = doc({'0:0': 'x'})
    state.sheets[0].stylesState = {
      '0:0': {fontWeight: 'bold', color: '#ff0000', backgroundColor: '#ffff00', textAlign: 'center'},
      '1:1': {backgroundColor: 'rgb(0, 128, 255)'}
    }
    const {XLSX, wb} = await buildWorkbook(state)
    const cell = wb.Sheets['Данные']['A1']
    expect(cell.s.font).toMatchObject({bold: true, color: {rgb: 'FF0000'}})
    expect(cell.s.alignment).toEqual({horizontal: 'center'})
    const buf = XLSX.write(wb, {type: 'array', bookType: 'xlsx'}) as ArrayBuffer
    const res = await parseXlsxFile(new File([buf], 'b.xlsx'))
    expect(res.sheets[0].stylesState['0:0']).toEqual({backgroundColor: '#FFFF00'})
    expect(res.sheets[0].stylesState['1:1']).toEqual({backgroundColor: '#0080FF'})
  })

  it('ширина столбца переживает круг', async () => {
    const state = doc({'0:0': '1'})
    state.sheets[0].colState = {'0': 200}
    const res = await roundtrip(state)
    expect(res.sheets[0].colState[0]).toBe(200)
  })
})

describe('convertFormula', () => {
  it('отвергает чужие листы и неизвестные функции', () => {
    expect(convertFormula('Sheet2!A1+1')).toBeNull()
    expect(convertFormula('VLOOKUP(A1,B1:C2,2,0)')).toBeNull()
    expect(convertFormula('SUM($A$1:B2)')).toBe('=SUM($A$1:B2)')
  })
  it('toExcelFormula: ; -> , и верхний регистр вне строк', () => {
    expect(toExcelFormula('if(a1>1;"a;b";"c")')).toBe('IF(A1>1,"a;b","c")')
  })
})

describe('csv', () => {
  it('разделитель ; кавычки и десятичная запятая', () => {
    expect(parseCsv('a;b\n1,5;"x;y"\n"q""w";01')).toEqual([
      ['a', 'b'], ['1.5', 'x;y'], ['q"w', '01']
    ])
  })
})
