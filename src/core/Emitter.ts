import type {EmitterListener, Unsubscribe} from '@core/types'

/** Простой pub/sub-эмиттер для общения компонентов между собой. */
export class Emitter {
  private listeners: Record<string, EmitterListener[]> = {}

  emit(event: string, ...args: unknown[]): boolean {
    if (!Array.isArray(this.listeners[event])) {
      return false
    }
    this.listeners[event].forEach(listener => listener(...args))
    return true
  }

  subscribe(event: string, fn: EmitterListener): Unsubscribe {
    this.listeners[event] = this.listeners[event] || []
    this.listeners[event].push(fn)
    return () => {
      this.listeners[event] = this.listeners[event]
          .filter(listener => listener !== fn)
    }
  }
}
