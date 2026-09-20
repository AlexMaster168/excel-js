import {ExcelComponent} from '@core/ExcelComponent'
import {$} from '@core/dom'
import {changeTitle, importSheets} from '@/redux/actions'
import {defaultTitle} from '@/constants'
import {debounce, storage, escapeHtml} from '@core/utils'
import {ActiveRoute} from '@core/routes/ActiveRoute'
import {parseXlsxFile} from '@core/xlsx/import'
import {exportXlsx} from '@core/xlsx/export'

function storageName(param) {
  return 'excel' + param
}

export class Header extends ExcelComponent {
  static className = 'excel__header'

  constructor($root, options) {
    super($root, {
      name: 'Header',
      listeners: ['input', 'click'],
      ...options
    })
  }

  prepare() {
    this.onInput = debounce(this.onInput, 300)
  }

  toHTML() {
    const title = this.store.getState().title || defaultTitle
    return `
      <input type="text" class="input" value="${escapeHtml(title)}" />
      <div>
        <div class="button" data-button="undo" title="Отменить (Ctrl+Z)">
          <i data-button="undo" class="material-icons">undo</i>
        </div>
        <div class="button" data-button="redo" title="Вернуть (Ctrl+Y)">
          <i data-button="redo" class="material-icons">redo</i>
        </div>
        <div class="button" data-button="import" title="Открыть .xlsx">
          <i data-button="import" class="material-icons">upload_file</i>
        </div>
        <div class="button" data-button="export" title="Скачать .xlsx">
          <i data-button="export" class="material-icons">download</i>
        </div>
        <div class="button" data-button="remove" title="Удалить таблицу">
          <i data-button="remove" class="material-icons">delete</i>
        </div>
        <div class="button" data-button="exit" title="На дашборд">
          <i data-button="exit" class="material-icons">exit_to_app</i>
        </div>
      </div>
      <input type="file" id="excel-import"
             accept=".xlsx,.xls,.csv" style="display: none" />
    `
  }

  init() {
    super.init()
    // change у file input навешиваем напрямую — это не bubbling-friendly событие
    this.$root.find('#excel-import').on('change', this.onImportFile.bind(this))
  }

  async onImportFile(event) {
    const input = event.target
    const file = input.files && input.files[0]
    // сбрасываем value, иначе повторный выбор того же файла не вызовет change
    input.value = ''
    if (!file) {
      return
    }
    try {
      const {title, sheets, warnings} = await parseXlsxFile(file)
      if (warnings.length) {
        alert(warnings.join('\n'))
      }
      // через стор, чтобы отложенное (debounce) сохранение не затёрло импорт старым состоянием
      this.store.dispatch(importSheets({title, sheets}))
      storage(storageName(ActiveRoute.param), this.store.getState())
      window.location.reload()
    } catch (e) {
      alert('Не удалось открыть файл: ' + (e && e.message ? e.message : e))
    }
  }

  onClick(event) {
    const $target = $(event.target)
    const button = $target.data.button
    if (button === 'undo') {
      this.store.undo()
    } else if (button === 'redo') {
      this.store.redo()
    } else if (button === 'remove') {
      const decision = confirm('Точно удалить эту таблицу?')
      if (decision) {
        localStorage.removeItem(storageName(ActiveRoute.param))
        ActiveRoute.navigate('')
      }
    } else if (button === 'exit') {
      ActiveRoute.navigate('')
    } else if (button === 'import') {
      this.$root.find('#excel-import').$el.click()
    } else if (button === 'export') {
      exportXlsx(this.store.getState()).catch(e => {
        alert('Не удалось сохранить файл: ' + (e && e.message ? e.message : e))
      })
    }
  }

  onInput(event) {
    const $target = $(event.target)
    this.$dispatch(changeTitle($target.text()))
  }
}
