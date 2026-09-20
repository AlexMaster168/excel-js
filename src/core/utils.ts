export function capitalize(value: string): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function range(start: number, end: number): number[] {
  if (start > end) {
    ;[end, start] = [start, end]
  }
  return new Array(end - start + 1)
      .fill('')
      .map((_, index) => start + index)
}

export function storage(key: string): unknown
export function storage(key: string, data: unknown): void
export function storage(key: string, data: unknown = null): unknown {
  if (!data) {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }
  localStorage.setItem(key, JSON.stringify(data))
}

export function isEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return a === b
}

export function camelToDashCase(str: string): string {
  return str.replace(/([A-Z])/g, g => `-${g[0].toLowerCase()}`)
}

export function toInlineStyles(
    styles: Record<string, string | number | undefined> = {}
): string {
  return Object.keys(styles)
      .map(key => `${camelToDashCase(key)}: ${styles[key]}`)
      .join(';')
}

export function debounce<A extends unknown[]>(
    fn: (...args: A) => void,
    wait: number
): (...args: A) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return function(this: unknown, ...args: A) {
    const later = () => {
      clearTimeout(timeout)
      fn.apply(this, args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

export function preventDefault(event: Event): void {
  event.preventDefault()
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

/** Экранирует текст для вставки в HTML (содержимое и значения атрибутов). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch])
}
