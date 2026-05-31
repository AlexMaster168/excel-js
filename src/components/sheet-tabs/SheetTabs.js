import {ExcelComponent} from '@core/ExcelComponent'
import {showContextMenu, closeContextMenu} from '@/components/context-menu/contextMenu'
import * as actions from '@/redux/actions'

export class SheetTabs extends ExcelComponent {
  static className = 'excel__sheet-tabs'

  constructor($root, options) {
    super($root, {
      name: 'SheetTabs',
      listeners: ['click', 'dblclick', 'contextmenu'],
      subscribe: ['sheets', 'activeSheet'],
      ...options
    })
  }

  tabsHTML(state) {
    const tabs = state.sheets.map((s, i) => `
      <div class="sheet-tab ${i === state.activeSheet ? 'active' : ''}"
           data-sheet="${i}" title="${s.name}">${s.name}</div>
    `).join('')
    return `
      ${tabs}
      <div class="sheet-tab sheet-tab-add" data-action="add-sheet"
           title="Добавить лист">+</div>
    `
  }

  toHTML() {
    return this.tabsHTML(this.store.getState())
  }

  storeChanged() {
    closeContextMenu()
    this.$root.html(this.tabsHTML(this.store.getState()))
  }

  onClick(event) {
    if (event.target.dataset.action === 'add-sheet') {
      this.$dispatch(actions.addSheet())
      return
    }
    const tab = event.target.closest('[data-sheet]')
    if (tab) {
      this.$dispatch(actions.setActiveSheet(+tab.dataset.sheet))
    }
  }

  onDblclick(event) {
    const tab = event.target.closest('[data-sheet]')
    if (tab) {
      this.editTabName(tab, +tab.dataset.sheet)
    }
  }

  onContextmenu(event) {
    const tab = event.target.closest('[data-sheet]')
    if (!tab) {
      return
    }
    event.preventDefault()
    const index = +tab.dataset.sheet
    const canDelete = this.store.getState().sheets.length > 1
    const items = [
      {label: 'Переименовать', onClick: () => this.editTabName(tab, index)},
      {label: 'Дублировать', onClick: () => this.$dispatch(actions.duplicateSheet(index))}
    ]
    if (canDelete) {
      items.push({
        label: 'Удалить лист',
        danger: true,
        onClick: () => this.$dispatch(actions.deleteSheet(index))
      })
    }
    showContextMenu(event.clientX, event.clientY, items)
  }

  // редактирование имени вкладки на месте (contenteditable)
  editTabName(tab, index) {
    tab.setAttribute('contenteditable', 'true')
    tab.focus()
    const range = document.createRange()
    range.selectNodeContents(tab)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)

    const onKey = e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        tab.blur()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        tab.removeEventListener('blur', finish)
        this.storeChanged()
      }
    }
    const finish = () => {
      tab.removeEventListener('blur', finish)
      tab.removeEventListener('keydown', onKey)
      this.$dispatch(actions.renameSheet({index, name: tab.textContent.trim()}))
      this.storeChanged()
    }
    tab.addEventListener('blur', finish)
    tab.addEventListener('keydown', onKey)
  }
}
