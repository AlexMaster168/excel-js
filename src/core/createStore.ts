import type {Reducer, Store} from '@core/types'

/** Минималистичный redux-подобный стор. */
export function createStore<S, A extends {type: string}>(
    rootReducer: Reducer<S, A>,
    initialState: S
): Store<S, A> {
  let state: S = initialState
  let listeners: Array<(state: S) => void> = []

  return {
    subscribe(fn) {
      listeners.push(fn)
      return {
        unsubscribe() {
          listeners = listeners.filter(l => l !== fn)
        }
      }
    },
    dispatch(action) {
      state = rootReducer(state, action)
      listeners.forEach(listener => listener(state))
    },
    getState() {
      return JSON.parse(JSON.stringify(state)) as S
    }
  }
}
