// Инфраструктурные (доменно-независимые) типы ядра.
// Доменные типы приложения (форма состояния, экшены) живут в src/redux/types.ts.

export type Unsubscribe = () => void

/** Колбэк подписки на событие эмиттера. */
export type EmitterListener = (...args: unknown[]) => void

/** Чистый редьюсер: (состояние, экшен) -> новое состояние. */
export type Reducer<S, A> = (state: S, action: A) => S

export interface Subscription {
  unsubscribe: Unsubscribe
}

/** Контракт стора (redux-подобный). */
export interface Store<S, A> {
  subscribe(fn: (state: S) => void): Subscription
  dispatch(action: A): void
  getState(): S
}
