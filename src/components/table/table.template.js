import {toInlineStyles, escapeHtml} from '@core/utils'
import {defaultStyles, defaultCols, defaultRows} from '@/constants'
import {evaluateCell, colToLetters} from '@core/formula'
import {renderChartSvg} from '@core/chart/render'
import {chartDataFromRange} from '@core/chart/data'

const DEFAULT_WIDTH = 120
const DEFAULT_HEIGHT = 24

function getWidth(state, index) {
  return (state[index] || DEFAULT_WIDTH) + 'px'
}

function getHeight(state, index) {
  return (state[index] || DEFAULT_HEIGHT) + 'px'
}

function inRange(range, row, col) {
  return row >= range.r1 && row <= range.r2 &&
         col >= range.c1 && col <= range.c2
}

// классы оформления для ячейки, входящей в объект-таблицу (зебра/шапка/рамка)
function tableClasses(tables, row, col) {
  for (const t of tables) {
    const r = t.range
    if (!inRange(r, row, col)) {
      continue
    }
    const cls = ['in-table']
    if (row === r.r1) {
      cls.push('table-head')
    } else if ((row - r.r1) % 2 === 0) {
      cls.push('table-alt')
    }
    if (row === r.r1) cls.push('tb-top')
    if (row === r.r2) cls.push('tb-bottom')
    if (col === r.c1) cls.push('tb-left')
    if (col === r.c2) cls.push('tb-right')
    return cls.join(' ')
  }
  return ''
}

// бейджи таблиц (имя + ручка перетаскивания). Позицию проставит Table в DOM
// по геометрии левой-верхней ячейки — поэтому здесь только якорь data-anchor.
function tableBadges(tables) {
  return tables
      .map(t => `<span class="table-badge" data-table-move="${t.id}"
        data-anchor="${t.range.r1}:${t.range.c1}"
        title="Перетащить таблицу «${escapeHtml(t.name)}»">${escapeHtml(t.name)}</span>`)
      .join('')
}

function widthPx(state, index) {
  return state[index] || DEFAULT_WIDTH
}

function heightPx(state, index) {
  return state[index] || DEFAULT_HEIGHT
}

// стиль/класс ячейки в объединении. Главная ячейка (левая-верхняя) занимает в потоке
// свой слот (отрицательный margin-right), а рисуется на всю площадь объединения;
// остальные ячейки диапазона остаются в потоке, но невидимы.
function mergeInfo(sheet, row, col) {
  for (const m of sheet.merges || []) {
    if (!inRange(m, row, col)) {
      continue
    }
    if (row !== m.r1 || col !== m.c1) {
      return {cls: 'merged-hidden', style: ''}
    }
    let w = 0
    for (let c = m.c1; c <= m.c2; c++) w += widthPx(sheet.colState, c)
    let h = 0
    for (let r = m.r1; r <= m.r2; r++) h += heightPx(sheet.rowState, r)
    const own = widthPx(sheet.colState, col)
    return {
      cls: 'merged-master',
      style: `; flex: none; width: ${w}px; height: ${h}px; margin-right: ${own - w}px`
    }
  }
  return {cls: '', style: ''}
}

function toCell(sheet, row) {
  const ctx = {getRaw: cid => sheet.dataState[cid]}
  const tables = sheet.tables || []
  return function(_, col) {
    const id = `${row}:${col}`
    const width = getWidth(sheet.colState, col)
    const data = sheet.dataState[id]
    const styles = toInlineStyles({
      ...defaultStyles,
      ...sheet.stylesState[id]
    })
    const merge = mergeInfo(sheet, row, col)
    const extra = `${tableClasses(tables, row, col)} ${merge.cls}`
    return `
      <div
        class="cell ${extra}"
        contenteditable
        data-col="${col}"
        data-type="cell"
        data-id="${id}"
        data-value="${escapeHtml(data)}"
        style="${styles}; width: ${width}${merge.style}"
      >${escapeHtml(evaluateCell(id, ctx))}</div>
    `
  }
}

function toColumn({title, index, width}) {
  return `
    <div
      class="column"
      data-type="resizable"
      data-col="${index}"
      style="width: ${width}"
    >
      <span class="col-title" data-col-header data-col="${index}">${escapeHtml(title)}</span>
      <div class="col-resize" data-resize="col"></div>
    </div>
  `
}

// rowIndex === null -> строка заголовков столбцов; иначе 0-based индекс строки
function createRow(rowIndex, content, sheet) {
  const isData = rowIndex !== null
  const resize = isData
    ? '<div class="row-resize" data-resize="row"></div>'
    : ''
  const height = isData ? getHeight(sheet.rowState, rowIndex) : DEFAULT_HEIGHT + 'px'
  const display = isData ? escapeHtml(sheet.rowTitles[rowIndex] || (rowIndex + 1)) : ''
  const rowHeader = isData
    ? `<span class="row-title" data-row-header data-row="${rowIndex}">${display}</span>`
    : ''
  return `
    <div
      class="row"
      data-type="resizable"
      data-row="${isData ? rowIndex : ''}"
      style="height: ${height}"
    >
      <div class="row-info">
        ${rowHeader}
        ${resize}
      </div>
      <div class="row-data">${content}</div>
    </div>
  `
}

function colHeaderFrom(sheet) {
  return function(_, index) {
    return {
      title: sheet.colTitles[index] || colToLetters(index),
      index,
      width: getWidth(sheet.colState, index)
    }
  }
}

const CHART_NAMES = {bar: 'Столбцы', line: 'Линия', pie: 'Круговая'}

// плавающие карточки графиков + бейджи таблиц поверх листа
function chartsOverlay(sheet) {
  const charts = sheet.charts || []
  const tables = sheet.tables || []
  if (!charts.length && !tables.length) {
    return ''
  }
  const cards = charts
      .map((chart, i) => {
        const data = chartDataFromRange(sheet, chart.range)
        const svg = renderChartSvg(chart.type, data)
        // позиция из state (drag), иначе раскладка сеткой 2-в-ряд
        const left = typeof chart.x === 'number' ? chart.x : 60 + (i % 2) * 350
        const top = typeof chart.y === 'number' ? chart.y : 60 + Math.floor(i / 2) * 250
        const label = chart.title || CHART_NAMES[chart.type] || 'График'
        return `
          <div class="chart-card" data-chart="${chart.id}"
               style="left:${left}px; top:${top}px">
            <div class="chart-card__head" data-chart-head="${chart.id}">
              <span class="chart-card__title" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
              <span class="chart-card__close" data-action="remove-chart"
                    data-chart="${chart.id}" title="Удалить график">&times;</span>
            </div>
            <div class="chart-card__body">${svg}</div>
          </div>
        `
      })
      .join('')
  return `<div class="table-overlay">${cards}${tableBadges(tables)}</div>`
}

export function createTable(sheet = {}) {
  const colsCount = sheet.colsCount || defaultCols
  const rowsCount = sheet.rowsCount || defaultRows
  const rows = []

  const cols = new Array(colsCount)
      .fill('')
      .map(colHeaderFrom(sheet))
      .map(toColumn)
      .join('')
  const addCol = `
    <div class="column column-add" data-action="add-col" title="Добавить столбец">+</div>
  `
  rows.push(createRow(null, cols + addCol, sheet))

  for (let row = 0; row < rowsCount; row++) {
    const cells = new Array(colsCount)
        .fill('')
        .map(toCell(sheet, row))
        .join('')
    rows.push(createRow(row, cells, sheet))
  }

  const addRow = `
    <div class="row">
      <div class="row-info row-add" data-action="add-row" title="Добавить строку">+</div>
    </div>
  `
  return rows.join('') + addRow + chartsOverlay(sheet)
}
