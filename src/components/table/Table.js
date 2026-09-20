import {ExcelComponent} from '@core/ExcelComponent'
import {$} from '@core/dom'
import {createTable} from '@/components/table/table.template'
import {resizeHandler} from '@/components/table/table.resize'
import {isCell, nextSelector, shouldResize} from './table.functions'
import {TableSelection} from '@/components/table/TableSelection'
import {showContextMenu, closeContextMenu} from '@/components/context-menu/contextMenu'
import * as actions from '@/redux/actions'
import {defaultStyles} from '@/constants'
import {expandToMerges, findMerge} from '@/redux/sheetOps'
import {promptDialog} from '@/components/dialog/promptDialog'
import {escapeHtml} from '@core/utils'
import {evaluateCell} from '@core/formula'
import {translateFormula} from '@core/formula/refShift'

export class Table extends ExcelComponent {
  static className = 'excel__table'

  constructor($root, options) {
    super($root, {
      name: 'Table',
      listeners: ['mousedown', 'keydown', 'input', 'click', 'dblclick', 'contextmenu'],
      subscribe: ['activeSheet'],
      ...options
    })
  }

  // активный лист документа
  activeSheet() {
    const state = this.store.getState()
    return state.sheets[state.activeSheet]
  }

  toHTML() {
    return createTable(this.activeSheet())
  }

  // сменили лист -> перерисовываем и выделяем A1
  storeChanged() {
    closeContextMenu()
    this.$root.html(createTable(this.activeSheet()))
    this.recalc()
    this.positionBadges()
    const $first = this.$root.find('[data-id="0:0"]')
    this.selection.select($first)
    this.$emit('table:select', $first)
  }

  // удаляем document-слушатели copy/paste при размонтировании
  destroy() {
    document.removeEventListener('copy', this.onCopy)
    document.removeEventListener('paste', this.onPaste)
    super.destroy()
  }

  // ставим бейджи таблиц в DOM по геометрии их левой-верхней ячейки
  positionBadges() {
    const root = this.$root.$el
    root.querySelectorAll('.table-badge').forEach(badge => {
      const cell = root.querySelector(`[data-id="${badge.dataset.anchor}"]`)
      if (cell) {
        badge.style.display = ''
        badge.style.left = cell.offsetLeft + 'px'
        badge.style.top = Math.max(0, cell.offsetTop - 1) + 'px'
      } else {
        badge.style.display = 'none'
      }
    })
  }

  prepare() {
    this.selection = new TableSelection()
    this.clipboard = null      // внутренний буфер (raw + стили)
    this.lastCopiedTsv = ''    // что мы положили в системный буфер
  }

  init() {
    super.init()
    this.selectCell(this.$root.find('[data-id="0:0"]'))
    this.positionBadges()

    // copy/paste диапазонов — вешаем на document (события не всплывают через DomListener)
    this.onCopy = this.onCopy.bind(this)
    this.onPaste = this.onPaste.bind(this)
    document.addEventListener('copy', this.onCopy)
    document.addEventListener('paste', this.onPaste)

    this.$on('formula:input', value => {
      this.selection.current
          .attr('data-value', value)
          .text(value)
      this.updateTextInStore(value)
    })

    this.$on('formula:done', () => {
      this.recalc()
      this.selection.current.focus()
    })

    this.$on('toolbar:applyStyle', value => {
      this.selection.applyStyle(value)
      this.$dispatch(actions.applyStyle({
        value,
        ids: this.selection.selectedIds
      }))
    })

    this.$on('toolbar:mergeCells', () => this.toggleMerge())
    this.$on('toolbar:insertTable', () => this.insertTable())
    this.$on('toolbar:insertChart', type => this.insertChart(type))

    // после undo/redo Table подписан только на activeSheet — перерисуем вручную
    this.$on('history:restore', () => this.renderTable())
  }

  // диспатч + ручной ре-рендер (Table подписан на activeSheet, не на sheets)
  applyOp(action) {
    this.$dispatch(action)
    this.renderTable()
  }

  // прямоугольник выделения {r1,c1,r2,c2} или null, если ничего не выбрано
  selectionRange() {
    const ids = this.selection.selectedIds
    if (!ids.length) {
      return null
    }
    let r1 = Infinity
    let c1 = Infinity
    let r2 = -1
    let c2 = -1
    ids.forEach(id => {
      const [r, c] = id.split(':').map(Number)
      r1 = Math.min(r1, r)
      c1 = Math.min(c1, c)
      r2 = Math.max(r2, r)
      c2 = Math.max(c2, c)
    })
    // выделенное объединение (или его часть) считается целиком, как в Excel
    return expandToMerges(this.activeSheet(), {r1, c1, r2, c2})
  }

  // объединить выделенный диапазон; если выделено готовое объединение — разъединить
  toggleMerge() {
    const range = this.selectionRange()
    if (!range) {
      return
    }
    const sheet = this.activeSheet()
    const existing = findMerge(sheet, range.r1, range.c1)
    const isSame = existing && existing.r1 === range.r1 && existing.c1 === range.c1 &&
      existing.r2 === range.r2 && existing.c2 === range.c2
    const single = range.r1 === range.r2 && range.c1 === range.c2
    if (isSame || (single && existing)) {
      this.applyOp(actions.unmergeCells(existing))
    } else if (!single) {
      this.applyOp(actions.mergeCells(range))
    }
  }

  async insertTable() {
    const range = this.selectionRange()
    if (!range) {
      return
    }
    const count = this.activeSheet().tables.length + 1
    const name = await promptDialog('Название таблицы:', `Таблица ${count}`)
    if (name === null) {
      return
    }
    this.applyOp(actions.addTable({
      name: name.trim() || `Таблица ${count}`,
      range
    }))
  }

  insertChart(type) {
    const range = this.selectionRange()
    if (!range) {
      return
    }
    this.applyOp(actions.addChart({type, title: '', range}))
  }

  selectCell($cell) {
    this.selection.select($cell)
    this.recalc()
    this.$emit('table:select', $cell)
    const styles = $cell.getStyles(Object.keys(defaultStyles))
    this.$dispatch(actions.changeStyles(styles))
  }

  // полный ре-рендер таблицы (рост/заголовки) с сохранением выделения, без $dispatch
  renderTable() {
    closeContextMenu()
    const prevId = this.selection.current ? this.selection.current.id() : '0:0'
    this.$root.html(createTable(this.activeSheet()))
    this.recalc()
    this.positionBadges()
    const $cell = this.$root.find(`[data-id="${prevId}"]`)
    const $target = $cell.$el ? $cell : this.$root.find('[data-id="0:0"]')
    this.selection.select($target)
    this.$emit('table:select', $target)
  }

  // Пересчитывает формулы активного листа (кроме ячейки в фокусе).
  recalc() {
    const {dataState} = this.activeSheet()
    const ctx = {getRaw: id => dataState[id]}
    Object.keys(dataState).forEach(id => {
      const raw = dataState[id]
      if (typeof raw === 'string' && raw.startsWith('=')) {
        const $cell = this.$root.find(`[data-id="${id}"]`)
        if ($cell.$el && document.activeElement !== $cell.$el) {
          $cell.text(evaluateCell(id, ctx))
        }
      }
    })
  }

  async resizeTable(event) {
    try {
      const data = await resizeHandler(this.$root, event)
      this.$dispatch(actions.tableResize(data))
      if ((this.activeSheet().merges || []).length) {
        this.renderTable() // ширина/высота объединений считается от размеров ячеек
      }
    } catch (e) {
      // resize отменён — молча игнорируем
    }
  }

  onClick(event) {
    const action = event.target.dataset.action
    if (action === 'add-row' || action === 'add-col') {
      this.applyOp(actions.tableGrow({
        axis: action === 'add-row' ? 'row' : 'col',
        count: 1
      }))
    } else if (action === 'remove-chart') {
      this.applyOp(actions.removeChart(event.target.dataset.chart))
    }
  }

  // правый клик по заголовку/ячейке -> меню вставки/удаления строк и столбцов
  onContextmenu(event) {
    const colH = event.target.closest('[data-col-header]')
    const rowH = event.target.closest('[data-row-header]')
    const cell = event.target.closest('[data-type="cell"]')
    let items = null
    if (colH) {
      items = this.colMenu(+colH.dataset.col)
    } else if (rowH) {
      items = this.rowMenu(+rowH.dataset.row)
    } else if (cell) {
      const [row, col] = cell.dataset.id.split(':').map(Number)
      items = [...this.rowMenu(row), {divider: true}, ...this.colMenu(col)]
      const range = this.selectionRange()
      const merged = findMerge(this.activeSheet(), row, col)
      if (merged) {
        items = [{label: 'Разъединить ячейки', onClick: () => this.applyOp(actions.unmergeCells(merged))},
          {divider: true}, ...items]
      } else if (range && (range.r1 !== range.r2 || range.c1 !== range.c2)) {
        items = [{label: 'Объединить ячейки', onClick: () => this.applyOp(actions.mergeCells(range))},
          {divider: true}, ...items]
      }
      const objects = this.objectsAt(row, col)
      if (objects.length) {
        items = [...objects, {divider: true}, ...items]
      }
    }
    if (items) {
      event.preventDefault()
      showContextMenu(event.clientX, event.clientY, items)
    }
  }

  // пункты удаления таблиц-объектов, накрывающих ячейку (row, col)
  objectsAt(row, col) {
    const sheet = this.activeSheet()
    const inRange = r => row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2
    return (sheet.tables || [])
        .filter(t => inRange(t.range))
        .map(t => ({
          label: `Удалить таблицу «${escapeHtml(t.name)}»`,
          danger: true,
          onClick: () => this.applyOp(actions.removeTable(t.id))
        }))
  }

  rowMenu(row) {
    return [
      {
        label: 'Вставить строку выше',
        onClick: () => this.applyOp(actions.tableInsert({axis: 'row', index: row}))
      },
      {
        label: 'Вставить строку ниже',
        onClick: () => this.applyOp(actions.tableInsert({axis: 'row', index: row + 1}))
      },
      {
        label: 'Удалить строку',
        danger: true,
        onClick: () => this.applyOp(actions.tableDelete({axis: 'row', index: row}))
      }
    ]
  }

  colMenu(col) {
    return [
      {
        label: 'Вставить столбец слева',
        onClick: () => this.applyOp(actions.tableInsert({axis: 'col', index: col}))
      },
      {
        label: 'Вставить столбец справа',
        onClick: () => this.applyOp(actions.tableInsert({axis: 'col', index: col + 1}))
      },
      {
        label: 'Удалить столбец',
        danger: true,
        onClick: () => this.applyOp(actions.tableDelete({axis: 'col', index: col}))
      }
    ]
  }

  // двойной клик по заголовку столбца/строки -> переименование
  onDblclick(event) {
    const colH = event.target.closest('[data-col-header]')
    const rowH = event.target.closest('[data-row-header]')
    if (colH) {
      this.editHeader(colH, 'col')
    } else if (rowH) {
      this.editHeader(rowH, 'row')
    }
  }

  editHeader(el, axis) {
    const index = axis === 'col' ? +el.dataset.col : +el.dataset.row
    el.setAttribute('contenteditable', 'true')
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)

    const onKey = e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        el.blur()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        el.removeEventListener('blur', finish)
        this.renderTable()
      }
    }
    const finish = () => {
      el.removeEventListener('blur', finish)
      el.removeEventListener('keydown', onKey)
      const title = el.textContent.trim()
      const make = axis === 'col' ? actions.setColTitle : actions.setRowTitle
      this.$dispatch(make({index, title}))
      this.renderTable()
    }
    el.addEventListener('blur', finish)
    el.addEventListener('keydown', onKey)
  }

  onMousedown(event) {
    if (event.button !== 0) {
      return // правый клик обрабатывает onContextmenu
    }
    // перетаскивание карточки графика за заголовок
    const head = event.target.closest('[data-chart-head]')
    if (head && !event.target.closest('.chart-card__close')) {
      this.startChartDrag(head.closest('.chart-card'), event)
      return
    }
    // перетаскивание таблицы-объекта за бейдж
    const badge = event.target.closest('[data-table-move]')
    if (badge) {
      this.startTableDrag(badge.dataset.tableMove, event)
      return
    }
    if (shouldResize(event)) {
      this.resizeTable(event)
      return
    }
    // выделение целого столбца/строки протягиванием по заголовкам
    const colH = event.target.closest('[data-col-header]')
    if (colH) {
      this.startHeaderDrag('col', +colH.dataset.col, event)
      return
    }
    const rowH = event.target.closest('[data-row-header]')
    if (rowH) {
      this.startHeaderDrag('row', +rowH.dataset.row, event)
      return
    }
    if (!isCell(event)) {
      return
    }
    const $target = $(event.target)
    if (event.shiftKey) {
      this.selectTo($target)
    } else {
      this.selectCell($target)
      this.startDragSelect($target)
    }
  }

  // автопрокрутка листа, когда курсор у края (для протяжки больших диапазонов)
  autoScroll(e) {
    const el = this.$root.$el
    const r = el.getBoundingClientRect()
    const m = 28
    const step = 24
    if (e.clientY > r.bottom - m) el.scrollTop += step
    else if (e.clientY < r.top + m) el.scrollTop -= step
    if (e.clientX > r.right - m) el.scrollLeft += step
    else if (e.clientX < r.left + m) el.scrollLeft -= step
  }

  // drag карточки графика; финальная позиция уходит в стор (undoable)
  startChartDrag(card, event) {
    event.preventDefault()
    const id = card.dataset.chart
    const startLeft = parseFloat(card.style.left) || 0
    const startTop = parseFloat(card.style.top) || 0
    const startX = event.pageX
    const startY = event.pageY
    card.classList.add('dragging')
    const onMove = e => {
      card.style.left = Math.max(0, startLeft + e.pageX - startX) + 'px'
      card.style.top = Math.max(0, startTop + e.pageY - startY) + 'px'
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      card.classList.remove('dragging')
      this.$dispatch(actions.moveChart({
        id,
        x: Math.max(0, parseFloat(card.style.left) || 0),
        y: Math.max(0, parseFloat(card.style.top) || 0)
      }))
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // drag таблицы-объекта: на отпускании переносим диапазон на целевую ячейку
  startTableDrag(id, event) {
    event.preventDefault()
    const t = this.activeSheet().tables.find(x => x.id === id)
    if (!t) {
      return
    }
    let lastCell = null
    const onMove = e => {
      this.autoScroll(e)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const cell = el && el.closest && el.closest('[data-type="cell"]')
      if (lastCell && lastCell !== cell) {
        lastCell.classList.remove('drop-target')
      }
      if (cell) {
        cell.classList.add('drop-target')
        lastCell = cell
      }
    }
    const onUp = e => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (lastCell) {
        lastCell.classList.remove('drop-target')
      }
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const cell = el && el.closest && el.closest('[data-type="cell"]')
      if (cell) {
        const [tr, tc] = cell.dataset.id.split(':').map(Number)
        const dRow = tr - t.range.r1
        const dCol = tc - t.range.c1
        if (dRow || dCol) {
          this.applyOp(actions.moveTable({id, dRow, dCol}))
          return
        }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // выделение целых столбцов/строк протягиванием по заголовкам
  startHeaderDrag(axis, index, event) {
    event.preventDefault()
    const sheet = this.activeSheet()
    const selectAxis = (from, to) => {
      const lo = Math.min(from, to)
      const hi = Math.max(from, to)
      const whole = axis === 'col'
        ? {r1: 0, c1: lo, r2: sheet.rowsCount - 1, c2: hi}
        : {r1: lo, c1: 0, r2: hi, c2: sheet.colsCount - 1}
      const r = expandToMerges(sheet, whole)
      const $cells = []
      for (let c = r.c1; c <= r.c2; c++) {
        for (let row = r.r1; row <= r.r2; row++) {
          $cells.push(this.$root.find(`[data-id="${row}:${c}"]`))
        }
      }
      const valid = $cells.filter($c => $c.$el)
      this.selection.selectGroup(valid)
      if (valid[0]) {
        this.selection.current = valid[0]
      }
    }
    selectAxis(index, index)
    const sel = axis === 'col' ? '[data-col-header]' : '[data-row-header]'
    const onMove = e => {
      this.autoScroll(e)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const h = el && el.closest && el.closest(sel)
      if (h) {
        selectAxis(index, +(axis === 'col' ? h.dataset.col : h.dataset.row))
      }
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  hasCellFocus() {
    const a = document.activeElement
    return !!(a && a.dataset && a.dataset.type === 'cell' && this.$root.$el.contains(a))
  }

  onCopy(e) {
    if (!this.hasCellFocus()) {
      return
    }
    // даём нативно скопировать выделенный текст внутри одной ячейки
    const sel = window.getSelection()
    if (this.selection.selectedIds.length <= 1 && sel && !sel.isCollapsed) {
      return
    }
    const range = this.selectionRange()
    if (!range) {
      return
    }
    const sheet = this.activeSheet()
    const ctx = {getRaw: id => sheet.dataState[id]}
    const cells = []
    const tsvRows = []
    for (let r = range.r1; r <= range.r2; r++) {
      const line = []
      const tline = []
      for (let c = range.c1; c <= range.c2; c++) {
        const id = `${r}:${c}`
        line.push({value: sheet.dataState[id] || '', style: sheet.stylesState[id] || {}})
        tline.push(String(evaluateCell(id, ctx)))
      }
      cells.push(line)
      tsvRows.push(tline.join('\t'))
    }
    const merges = (sheet.merges || [])
        .filter(m => m.r1 >= range.r1 && m.r2 <= range.r2 && m.c1 >= range.c1 && m.c2 <= range.c2)
        .map(m => ({r1: m.r1 - range.r1, c1: m.c1 - range.c1, r2: m.r2 - range.r1, c2: m.c2 - range.c1}))
    this.clipboard = {cells, merges, row: range.r1, col: range.c1}
    this.lastCopiedTsv = tsvRows.join('\n')
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', this.lastCopiedTsv)
      e.preventDefault()
    }
  }

  onPaste(e) {
    if (!this.hasCellFocus()) {
      return
    }
    e.preventDefault()
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : ''
    const [row, col] = this.selection.current.id().split(':').map(Number)
    let cells
    let merges = []
    if (this.clipboard && text === this.lastCopiedTsv) {
      merges = this.clipboard.merges
      // внутренний буфер: формулы (со сдвигом относительных ссылок) и стили
      const dRow = row - this.clipboard.row
      const dCol = col - this.clipboard.col
      cells = this.clipboard.cells.map(line => line.map(c => ({
        ...c,
        value: translateFormula(c.value, dRow, dCol)
      })))
    } else if (text) {
      cells = text.replace(/\r/g, '').split('\n')
          .map(line => line.split('\t').map(v => ({value: v})))
      const last = cells[cells.length - 1]
      if (last && last.length === 1 && last[0].value === '') {
        cells.pop()
      }
    } else {
      return
    }
    this.applyOp(actions.pasteRange({row, col, cells, merges}))
  }

  // id ячеек прямоугольника между двумя ячейками, расширенного до границ объединений
  rectIds($a, $b) {
    const a = $a.id(true)
    const b = $b.id(true)
    const r = expandToMerges(this.activeSheet(), {
      r1: Math.min(a.row, b.row), c1: Math.min(a.col, b.col),
      r2: Math.max(a.row, b.row), c2: Math.max(a.col, b.col)
    })
    const ids = []
    for (let c = r.c1; c <= r.c2; c++) {
      for (let row = r.r1; row <= r.r2; row++) {
        ids.push(`${row}:${c}`)
      }
    }
    return ids
  }

  // выделяет прямоугольник от якоря (current) до $target
  selectTo($target) {
    const $cells = this.rectIds($target, this.selection.current)
        .map(id => this.$root.find(`[data-id="${id}"]`))
        .filter($c => $c.$el)
    this.selection.selectGroup($cells)
  }

  // протягивание мышкой: выделяем прямоугольник ячеек до отпускания кнопки
  startDragSelect($anchor) {
    let moved = false
    const onMove = e => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const cell = el && el.closest && el.closest('[data-type="cell"]')
      if (!cell || cell.dataset.id === $anchor.id()) {
        return
      }
      moved = true
      const $cells = this.rectIds($anchor, $(cell))
          .map(id => this.$root.find(`[data-id="${id}"]`))
          .filter($c => $c.$el)
      this.selection.selectGroup($cells)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // убираем нативное выделение текста, оставшееся от протягивания
      if (moved) {
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
        }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  onKeydown(event) {
    const keys = [
      'Enter',
      'Tab',
      'ArrowLeft',
      'ArrowRight',
      'ArrowDown',
      'ArrowUp'
    ]
    const {key} = event
    if (keys.includes(key) && !event.shiftKey) {
      // не перехватываем навигацию во время правки заголовка
      if (event.target.hasAttribute('data-col-header') ||
          event.target.hasAttribute('data-row-header')) {
        return
      }
      event.preventDefault()
      const id = this.mergeAwarePos(key, this.selection.current.id(true))
      let $next = this.$root.find(nextSelector(key, id))
      // за краем листа ячейки нет — остаёмся на месте (иначе падение на null)
      if ($next.$el) {
        // попали в скрытую часть объединения -> выделяем его главную ячейку
        const {row, col} = $next.id(true)
        const m = findMerge(this.activeSheet(), row, col)
        if (m && (row !== m.r1 || col !== m.c1)) {
          $next = this.$root.find(`[data-id="${m.r1}:${m.c1}"]`)
        }
        this.selectCell($next)
      }
    }
  }

  // точка, от которой считаем шаг стрелки: выход за край объединения и привязка
  // цели к главной ячейке объединения (скрытые ячейки выделять нельзя)
  mergeAwarePos(key, {row, col}) {
    const sheet = this.activeSheet()
    const m = findMerge(sheet, row, col)
    if (m) {
      if (key === 'Enter' || key === 'ArrowDown') row = m.r2
      if (key === 'Tab' || key === 'ArrowRight') col = m.c2
    }
    return {row, col}
  }

  updateTextInStore(value) {
    this.$dispatch(actions.changeText({
      id: this.selection.current.id(),
      value
    }))
  }

  onInput(event) {
    const $cell = $(event.target)
    const text = $cell.text()
    $cell.attr('data-value', text)
    this.updateTextInStore(text)
  }
}
