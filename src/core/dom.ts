type Selector = string | HTMLElement | Element

/** Лёгкая обёртка над DOM-узлом (jQuery-стайл, цепочечный API). */
export class Dom {
  $el: HTMLElement

  constructor(selector: Selector) {
    this.$el = typeof selector === 'string'
      ? (document.querySelector(selector) as HTMLElement)
      : (selector as HTMLElement)
  }

  html(): string
  html(html: string): this
  html(html?: string): this | string {
    if (typeof html === 'string') {
      this.$el.innerHTML = html
      return this
    }
    return this.$el.outerHTML.trim()
  }

  clear(): this {
    this.html('')
    return this
  }

  text(): string
  text(text: string | number): this
  text(text?: string | number): this | string {
    if (typeof text !== 'undefined') {
      this.$el.textContent = String(text)
      return this
    }
    if (this.$el.tagName.toLowerCase() === 'input') {
      return (this.$el as HTMLInputElement).value.trim()
    }
    return this.$el.textContent?.trim() ?? ''
  }

  on(eventType: string, callback: EventListenerOrEventListenerObject): void {
    this.$el.addEventListener(eventType, callback)
  }

  off(eventType: string, callback: EventListenerOrEventListenerObject): void {
    this.$el.removeEventListener(eventType, callback)
  }

  find(selector: string): Dom {
    return $(this.$el.querySelector(selector) as HTMLElement)
  }

  append(node: Dom | HTMLElement | Element): this {
    const el = node instanceof Dom ? node.$el : node
    this.$el.append(el)
    return this
  }

  get data(): DOMStringMap {
    return this.$el.dataset
  }

  closest(selector: string): Dom {
    return $(this.$el.closest(selector) as HTMLElement)
  }

  getCoords(): DOMRect {
    return this.$el.getBoundingClientRect()
  }

  findAll(selector: string): NodeListOf<HTMLElement> {
    return this.$el.querySelectorAll<HTMLElement>(selector)
  }

  css(styles: Record<string, string | number> = {}): void {
    Object.keys(styles).forEach(key => {
      ;(this.$el.style as unknown as Record<string, string>)[key] =
        String(styles[key])
    })
  }

  getStyles(styles: string[] = []): Record<string, string> {
    return styles.reduce<Record<string, string>>((res, s) => {
      res[s] = (this.$el.style as unknown as Record<string, string>)[s]
      return res
    }, {})
  }

  id(): string
  id(parse: true): {row: number; col: number}
  id(parse?: boolean): string | {row: number; col: number} {
    if (parse) {
      const parsed = this.id().split(':')
      return {
        row: +parsed[0],
        col: +parsed[1]
      }
    }
    return this.data['id'] ?? ''
  }

  focus(): this {
    this.$el.focus()
    return this
  }

  attr(name: string): string | null
  attr(name: string, value: string): this
  attr(name: string, value?: string): this | string | null {
    // typeof-проверка, а не truthy: иначе attr(name, '') не сбрасывал бы атрибут
    if (typeof value !== 'undefined') {
      this.$el.setAttribute(name, value)
      return this
    }
    return this.$el.getAttribute(name)
  }

  addClass(className: string): this {
    this.$el.classList.add(className)
    return this
  }

  removeClass(className: string): this {
    this.$el.classList.remove(className)
    return this
  }
}

interface DomFactory {
  (selector: Selector): Dom
  create(tagName: string, classes?: string): Dom
}

export const $: DomFactory = ((selector: Selector) =>
  new Dom(selector)) as DomFactory

$.create = (tagName: string, classes = ''): Dom => {
  const el = document.createElement(tagName)
  if (classes) {
    el.classList.add(classes)
  }
  return new Dom(el)
}
