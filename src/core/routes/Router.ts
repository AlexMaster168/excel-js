import {$, Dom} from '@core/dom'
import {ActiveRoute} from '@core/routes/ActiveRoute'
import type {Page} from '@core/Page'

interface PageConstructor {
  new (param: string): Page
}

export interface Routes {
  dashboard: PageConstructor
  excel: PageConstructor
}

/** Простейший хеш-роутер: переключает страницы dashboard/excel. */
export class Router {
  private $placeholder: Dom
  private routes: Routes
  private page: Page | null = null

  constructor(selector: string, routes: Routes) {
    if (!selector) {
      throw new Error('Selector is not provided in Router')
    }
    this.$placeholder = $(selector)
    this.routes = routes
    this.changePageHandler = this.changePageHandler.bind(this)
    this.init()
  }

  private init(): void {
    window.addEventListener('hashchange', this.changePageHandler)
    this.changePageHandler()
  }

  changePageHandler(): void {
    if (this.page) {
      this.page.destroy()
    }
    this.$placeholder.clear()

    const Page = ActiveRoute.path.includes('excel')
      ? this.routes.excel
      : this.routes.dashboard

    this.page = new Page(ActiveRoute.param)
    this.$placeholder.append(this.page.getRoot())
    this.page.afterRender()
  }

  destroy(): void {
    window.removeEventListener('hashchange', this.changePageHandler)
  }
}
