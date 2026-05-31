// Undo/Redo поверх минималистичного стора. Патчит dispatch: перед каждым
// «значимым» действием кладёт снимок состояния в стек past. Undo/redo
// восстанавливают снимок целиком через SET_STATE.

import type {Emitter} from '@core/Emitter'
import type {Store} from '@core/types'
import {setState} from '@/redux/actions'
import {
  CHANGE_TEXT,
  CHANGE_TITLE,
  APPLY_STYLE,
  TABLE_RESIZE,
  TABLE_GROW,
  TABLE_DELETE,
  TABLE_INSERT,
  SET_COL_TITLE,
  SET_ROW_TITLE,
  ADD_TABLE,
  REMOVE_TABLE,
  MOVE_TABLE,
  ADD_CHART,
  REMOVE_CHART,
  MOVE_CHART,
  PASTE_RANGE,
  RENAME_SHEET,
  DELETE_SHEET,
  DUPLICATE_SHEET,
  ADD_SHEET,
  IMPORT_SHEETS,
  SET_STATE
} from '@/redux/types'
import type {Action, AppState} from '@/redux/types'

/** Действия, меняющие документ и попадающие в историю. */
const UNDOABLE = new Set<string>([
  CHANGE_TEXT, CHANGE_TITLE, APPLY_STYLE, TABLE_RESIZE, TABLE_GROW,
  TABLE_DELETE, TABLE_INSERT, SET_COL_TITLE, SET_ROW_TITLE,
  ADD_TABLE, REMOVE_TABLE, MOVE_TABLE, ADD_CHART, REMOVE_CHART, MOVE_CHART,
  PASTE_RANGE, RENAME_SHEET, DELETE_SHEET, DUPLICATE_SHEET, ADD_SHEET, IMPORT_SHEETS
])

const LIMIT = 100
const COALESCE_MS = 500

/**
 * Ключ коалесценции: непрерывный ввод в одну ячейку (или правка заголовка)
 * не плодит десятки записей — undo откатывает всё редактирование разом.
 */
function coalesceKey(action: Action): string | null {
  if (action.type === CHANGE_TEXT) {
    return 'text:' + action.data.id
  }
  if (action.type === CHANGE_TITLE) {
    return 'title'
  }
  return null
}

/** Стор с прикрученными методами undo/redo. */
export interface UndoableStore extends Store<AppState, Action> {
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
}

export interface HistoryHandle {
  dispose(): void
}

export function enableUndoRedo(
    store: Store<AppState, Action>,
    emitter: Emitter
): HistoryHandle {
  const s = store as UndoableStore
  const past: AppState[] = []
  const future: AppState[] = []
  let lastKey: string | null = null
  let lastTime = 0

  const orig = store.dispatch.bind(store)

  store.dispatch = (action: Action) => {
    if (action.type === SET_STATE) {
      return orig(action)
    }
    if (UNDOABLE.has(action.type)) {
      const key = coalesceKey(action)
      const now = Date.now()
      const coalesce = key !== null && key === lastKey && now - lastTime < COALESCE_MS
      if (!coalesce) {
        past.push(store.getState())
        if (past.length > LIMIT) {
          past.shift()
        }
        future.length = 0
      }
      lastKey = key
      lastTime = now
    } else {
      // нейтральное действие не должно «склеиваться» со следующим вводом
      lastKey = null
    }
    return orig(action)
  }

  const restore = (stack: AppState[], other: AppState[]) => {
    if (!stack.length) {
      return
    }
    other.push(store.getState())
    const snapshot = stack.pop() as AppState
    lastKey = null
    orig(setState(snapshot))
    // Table подписан только на activeSheet — даём ему сигнал перерисоваться
    emitter.emit('history:restore')
  }

  s.undo = () => restore(past, future)
  s.redo = () => restore(future, past)
  s.canUndo = () => past.length > 0
  s.canRedo = () => future.length > 0

  const onKey = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) {
      return
    }
    const k = e.key.toLowerCase()
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault()
      s.undo()
    } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
      e.preventDefault()
      s.redo()
    }
  }
  const hasDoc = typeof document !== 'undefined'
  if (hasDoc) {
    document.addEventListener('keydown', onKey)
  }

  return {
    dispose() {
      if (hasDoc) {
        document.removeEventListener('keydown', onKey)
      }
    }
  }
}
