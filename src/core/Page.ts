import type {Dom} from '@core/dom'

/** Базовый класс страницы роутера. */
export abstract class Page {
  protected params: unknown

  constructor(params: unknown) {
    this.params = params
  }

  abstract getRoot(): Dom

  afterRender(): void {}

  destroy(): void {}
}
