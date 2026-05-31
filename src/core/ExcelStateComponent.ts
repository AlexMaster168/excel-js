import {ExcelComponent} from '@core/ExcelComponent'

/** Компонент с собственным локальным состоянием (рендерит его как JSON). */
export class ExcelStateComponent extends ExcelComponent {
  protected state: Record<string, unknown> = {}

  get template(): string {
    return JSON.stringify(this.state, null, 2)
  }

  initState(initialState: Record<string, unknown> = {}): void {
    this.state = {...initialState}
  }

  setState(newState: Record<string, unknown>): void {
    this.state = {...this.state, ...newState}
    this.$root.html(this.template)
  }
}
