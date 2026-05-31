import {DomListener} from '@core/DomListener'
import type {Dom} from '@core/dom'
import type {Emitter} from '@core/Emitter'
import type {EmitterListener, Store, Unsubscribe} from '@core/types'
import type {Action, AppState} from '@/redux/types'

export interface ComponentOptions {
  name?: string
  listeners?: string[]
  subscribe?: string[]
  emitter: Emitter
  store: Store<AppState, Action>
}

/** Базовый компонент: DOM-слушатели + доступ к эмиттеру и стору. */
export class ExcelComponent extends DomListener {
  static className = ''

  emitter: Emitter
  subscribe: string[]
  store: Store<AppState, Action>
  unsubscribers: Unsubscribe[] = []

  constructor($root: Dom, options: ComponentOptions) {
    super($root, options.listeners)
    this.name = options.name || ''
    this.emitter = options.emitter
    this.subscribe = options.subscribe || []
    this.store = options.store
    this.unsubscribers = []
    this.prepare()
  }

  /** Хук подготовки до рендера (переопределяется в наследниках). */
  prepare(): void {}

  toHTML(): string {
    return ''
  }

  $emit(event: string, ...args: unknown[]): void {
    this.emitter.emit(event, ...args)
  }

  $on(event: string, fn: EmitterListener): void {
    const unsub = this.emitter.subscribe(event, fn)
    this.unsubscribers.push(unsub)
  }

  $dispatch(action: Action): void {
    this.store.dispatch(action)
  }

  /** Хук реакции на изменение стора (переопределяется в наследниках). */
  storeChanged(_changes: Partial<AppState>): void {}

  isWatching(key: string): boolean {
    return this.subscribe.includes(key)
  }

  init(): void {
    this.initDOMListeners()
  }

  destroy(): void {
    this.removeDOMListeners()
    this.unsubscribers.forEach(unsub => unsub())
  }
}
