import {capitalize} from '@core/utils'
import type {Dom} from '@core/dom'

type DomEventHandler = (event: Event) => void

/** Базовый класс: навешивает/снимает DOM-слушатели по соглашению onEventName. */
export class DomListener {
  $root: Dom
  listeners: string[]
  name = ''

  constructor($root: Dom, listeners: string[] = []) {
    if (!$root) {
      throw new Error(`No $root provided for DomListener!`)
    }
    this.$root = $root
    this.listeners = listeners
  }

  initDOMListeners(): void {
    this.listeners.forEach(listener => {
      const method = getMethodName(listener)
      const self = this as unknown as Record<string, DomEventHandler | undefined>
      if (!self[method]) {
        throw new Error(
            `Method ${method} is not implemented in ${this.name} Component`
        )
      }
      self[method] = (self[method] as DomEventHandler).bind(this)
      this.$root.on(listener, self[method] as DomEventHandler)
    })
  }

  removeDOMListeners(): void {
    this.listeners.forEach(listener => {
      const method = getMethodName(listener)
      const self = this as unknown as Record<string, DomEventHandler>
      this.$root.off(listener, self[method])
    })
  }
}

function getMethodName(eventName: string): string {
  return 'on' + capitalize(eventName)
}
