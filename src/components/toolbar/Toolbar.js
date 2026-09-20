import {createToolbar} from '@/components/toolbar/toolbar.template'
import {$} from '@core/dom'
import {ExcelStateComponent} from '@core/ExcelStateComponent'
import {defaultStyles} from '@/constants'

export class Toolbar extends ExcelStateComponent {
  static className = 'excel__toolbar'

  constructor($root, options) {
    super($root, {
      name: 'Toolbar',
      listeners: ['click'],
      subscribe: ['currentStyles'],
      ...options
    })
  }

  prepare() {
    this.initState(defaultStyles)
  }

  get template() {
    return createToolbar(this.state)
  }

  toHTML() {
    return this.template
  }

  storeChanged(changes) {
    this.setState(changes.currentStyles)
  }

  onClick(event) {
    const $target = $(event.target)
    if ($target.data.type === 'button') {
      const value = JSON.parse($target.data.value)
      this.$emit('toolbar:applyStyle', value)
      return
    }
    const action = event.target.dataset.action
    if (action === 'merge-cells') {
      this.$emit('toolbar:mergeCells')
    } else if (action === 'insert-table') {
      this.$emit('toolbar:insertTable')
    } else if (action === 'chart-bar') {
      this.$emit('toolbar:insertChart', 'bar')
    } else if (action === 'chart-line') {
      this.$emit('toolbar:insertChart', 'line')
    } else if (action === 'chart-pie') {
      this.$emit('toolbar:insertChart', 'pie')
    }
  }
}
