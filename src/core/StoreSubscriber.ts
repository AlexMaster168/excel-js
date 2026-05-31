import {isEqual} from '@core/utils'
import type {Store, Subscription} from '@core/types'
import type {Action, AppState} from '@/redux/types'

interface WatchingComponent {
  isWatching(key: string): boolean
  storeChanged(changes: Partial<AppState>): void
}

/** Связывает стор с компонентами: уведомляет только тех, кто следит за ключом. */
export class StoreSubscriber {
  private store: Store<AppState, Action>
  private sub: Subscription | null = null
  private prevState: Partial<AppState> = {}

  constructor(store: Store<AppState, Action>) {
    this.store = store
  }

  subscribeComponents(components: WatchingComponent[]): void {
    this.prevState = this.store.getState()
    this.sub = this.store.subscribe(state => {
      ;(Object.keys(state) as Array<keyof AppState>).forEach(key => {
        if (!isEqual(this.prevState[key], state[key])) {
          components.forEach(component => {
            if (component.isWatching(key)) {
              const changes = {[key]: state[key]} as Partial<AppState>
              component.storeChanged(changes)
            }
          })
        }
      })
      this.prevState = this.store.getState()
    })
  }

  unsubscribeFromStore(): void {
    this.sub?.unsubscribe()
  }
}
