import {ExcelComponent} from '@core/ExcelComponent'
import {$} from '@core/dom'
import {FUNCTION_LIST, CATEGORY_LABELS} from '@core/formula'

const CATEGORIES = [
  {key: 'all', label: 'Все'},
  {key: 'math', label: 'Математ.'},
  {key: 'stat', label: 'Статист.'},
  {key: 'logic', label: 'Логич.'},
  {key: 'text', label: 'Текст'},
  {key: 'date', label: 'Дата'}
]

function placeCaretAt(el, offset) {
  const node = el.firstChild || el
  const max = (node.textContent || '').length
  const range = document.createRange()
  range.setStart(node, Math.min(offset, max))
  range.collapse(true)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

export class Formula extends ExcelComponent {
  static className = 'excel__formula'

  constructor($root, options) {
    super($root, {
      name: 'Formula',
      listeners: ['input', 'keydown', 'click'],
      subscribe: ['currentText'],
      ...options
    })
    this.panelOpen = false
    this.search = ''
    this.category = 'all'
    this.selectedFn = null
  }

  toHTML() {
    return `
      <div class="info" data-fx="toggle" title="Вставить функцию">fx</div>
      <div id="formula" class="input" contenteditable spellcheck="false"></div>
      <div class="formula__dialog" data-fx-panel>
        <div class="formula__dialog-head">
          <input type="text" class="formula__search"
                 placeholder="Поиск функции…" data-fx-search />
          <div class="formula__tabs" data-fx-tabs></div>
        </div>
        <div class="formula__dialog-body">
          <div class="formula__fnlist" data-fx-list></div>
          <div class="formula__fninfo" data-fx-info></div>
        </div>
      </div>
    `
  }

  init() {
    super.init()
    this.$formula = this.$root.find('#formula')
    this.$panel = this.$root.find('[data-fx-panel]')
    this.$tabs = this.$root.find('[data-fx-tabs]')
    this.$list = this.$root.find('[data-fx-list]')
    this.$info = this.$root.find('[data-fx-info]')

    this.renderTabs()
    this.renderList()
    this.renderInfo(null)

    this.$on('table:select', $cell => {
      this.togglePanel(false)
      this.$formula.text($cell.data.value)
    })
  }

  storeChanged({currentText}) {
    // не перезаписываем поле, пока юзер в нём печатает (иначе каретка прыгает)
    if (document.activeElement !== this.$formula.$el) {
      this.$formula.text(currentText)
    }
  }

  // --- панель функций ---

  togglePanel(force) {
    const open = typeof force === 'boolean' ? force : !this.panelOpen
    this.panelOpen = open
    if (open) {
      this.$panel.addClass('open')
      this.renderList()
    } else {
      this.$panel.removeClass('open')
    }
  }

  filteredFunctions() {
    const q = this.search.trim().toLowerCase()
    return FUNCTION_LIST.filter(f => {
      if (this.category !== 'all' && f.category !== this.category) {
        return false
      }
      if (!q) {
        return true
      }
      return f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q)
    })
  }

  renderTabs() {
    this.$tabs.html(CATEGORIES.map(c => `
      <button class="formula__tab ${this.category === c.key ? 'active' : ''}"
              data-cat="${c.key}">${c.label}</button>
    `).join(''))
  }

  renderList() {
    const items = this.filteredFunctions().map(f => `
      <div class="formula__fn ${this.selectedFn === f.name ? 'active' : ''}"
           data-fn="${f.name}">
        <span class="formula__fn-name" data-fn="${f.name}">${f.name}</span>
        <span class="formula__fn-cat" data-fn="${f.name}">${CATEGORY_LABELS[f.category]}</span>
      </div>
    `).join('')
    this.$list.html(items || '<div class="formula__empty">Ничего не найдено</div>')
  }

  renderInfo(name) {
    const f = name && FUNCTION_LIST.find(x => x.name === name)
    if (!f) {
      this.$info.html('<div class="formula__hint">Выберите функцию из списка</div>')
      return
    }
    this.$info.html(`
      <div class="formula__info-name">${f.name}</div>
      <div class="formula__info-syntax">${f.syntax}</div>
      <div class="formula__info-desc">${f.description}</div>
      <button class="formula__insert" data-fx-insert>Вставить в формулу</button>
    `)
  }

  insertFunction(name) {
    const text = `=${name}()`
    this.$formula.text(text)
    this.$emit('formula:input', text)
    this.togglePanel(false)
    this.$formula.focus()
    placeCaretAt(this.$formula.$el, text.length - 1) // курсор между скобок
  }

  // --- обработчики событий ---

  onClick(event) {
    const target = event.target

    if (target.closest('[data-fx-insert]')) {
      if (this.selectedFn) {
        this.insertFunction(this.selectedFn)
      }
      return
    }

    const fnEl = target.closest('[data-fn]')
    if (fnEl) {
      this.selectedFn = fnEl.dataset.fn
      this.renderList()
      this.renderInfo(this.selectedFn)
      return
    }

    const catEl = target.closest('[data-cat]')
    if (catEl) {
      this.category = catEl.dataset.cat
      this.renderTabs()
      this.renderList()
      return
    }

    if (target.closest('[data-fx="toggle"]')) {
      this.togglePanel()
      return
    }

    if (target === this.$formula.$el) {
      this.togglePanel(false)
    }
  }

  onInput(event) {
    if (event.target === this.$formula.$el) {
      const text = $(event.target).text()
      this.$emit('formula:input', text)
      // авто-открытие панели функций когда начинаешь формулу с '='
      this.togglePanel(text.trim().startsWith('='))
      return
    }
    if (event.target.matches('[data-fx-search]')) {
      this.search = event.target.value
      this.renderList()
    }
  }

  onKeydown(event) {
    // Enter/Tab завершают ввод только в самой строке формул
    if (event.target !== this.$formula.$el) {
      return
    }
    const keys = ['Enter', 'Tab']
    if (keys.includes(event.key)) {
      event.preventDefault()
      this.togglePanel(false)
      this.$emit('formula:done')
    }
  }
}
