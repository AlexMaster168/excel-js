import {describe, expect, it} from 'vitest'
import {createStore} from '@core/createStore'
import {Emitter} from '@core/Emitter'
import {enableUndoRedo} from '@core/history'
import type {UndoableStore} from '@core/history'
import {rootReducer} from '@/redux/rootReducer'
import {normalizeInitialState} from '@/redux/initialState'
import {changeText, addSheet} from '@/redux/actions'

function setup(): UndoableStore {
  const store = createStore(rootReducer, normalizeInitialState(null))
  enableUndoRedo(store, new Emitter())
  return store as UndoableStore
}

function data(store: UndoableStore, id: string): string | undefined {
  const s = store.getState()
  return s.sheets[s.activeSheet].dataState[id]
}

describe('undo/redo', () => {
  it('отменяет и возвращает ввод текста', () => {
    const store = setup()
    store.dispatch(changeText({id: '0:0', value: 'Привет'}))
    expect(data(store, '0:0')).toBe('Привет')

    store.undo()
    expect(data(store, '0:0')).toBeUndefined()

    store.redo()
    expect(data(store, '0:0')).toBe('Привет')
  })

  it('склеивает непрерывный ввод в одну ячейку в одну запись', () => {
    const store = setup()
    store.dispatch(changeText({id: '0:0', value: 'a'}))
    store.dispatch(changeText({id: '0:0', value: 'ab'}))
    store.dispatch(changeText({id: '0:0', value: 'abc'}))

    store.undo() // один откат должен убрать всё редактирование ячейки
    expect(data(store, '0:0')).toBeUndefined()
  })

  it('разные ячейки — отдельные шаги истории', () => {
    const store = setup()
    store.dispatch(changeText({id: '0:0', value: 'A'}))
    store.dispatch(changeText({id: '0:1', value: 'B'}))

    store.undo()
    expect(data(store, '0:1')).toBeUndefined()
    expect(data(store, '0:0')).toBe('A')

    store.undo()
    expect(data(store, '0:0')).toBeUndefined()
  })

  it('новое действие очищает стек redo', () => {
    const store = setup()
    store.dispatch(changeText({id: '0:0', value: 'A'}))
    store.undo()
    expect(store.canRedo()).toBe(true)

    store.dispatch(changeText({id: '0:0', value: 'X'}))
    expect(store.canRedo()).toBe(false)
  })

  it('отменяет добавление листа', () => {
    const store = setup()
    expect(store.getState().sheets).toHaveLength(1)
    store.dispatch(addSheet())
    expect(store.getState().sheets).toHaveLength(2)
    store.undo()
    expect(store.getState().sheets).toHaveLength(1)
  })

  it('canUndo/canRedo отражают состояние стеков', () => {
    const store = setup()
    expect(store.canUndo()).toBe(false)
    store.dispatch(changeText({id: '0:0', value: 'A'}))
    expect(store.canUndo()).toBe(true)
    expect(store.canRedo()).toBe(false)
  })
})
