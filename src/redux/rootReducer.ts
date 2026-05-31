import {
  CHANGE_TEXT,
  CHANGE_STYLES,
  TABLE_RESIZE,
  APPLY_STYLE,
  CHANGE_TITLE,
  UPDATE_DATE,
  TABLE_GROW,
  TABLE_DELETE,
  TABLE_INSERT,
  SET_ACTIVE_SHEET,
  ADD_SHEET,
  RENAME_SHEET,
  DELETE_SHEET,
  DUPLICATE_SHEET,
  IMPORT_SHEETS,
  SET_COL_TITLE,
  SET_ROW_TITLE,
  ADD_TABLE,
  REMOVE_TABLE,
  MOVE_TABLE,
  ADD_CHART,
  REMOVE_CHART,
  MOVE_CHART,
  PASTE_RANGE,
  SET_STATE
} from '@/redux/types'
import type {Action, AppState, SheetState} from '@/redux/types'
import {emptySheet} from '@/redux/initialState'
import {deleteAxis, insertAxis, moveRange, pasteRange} from '@/redux/sheetOps'
import {genId} from '@/redux/actions'
import {clone} from '@core/utils'

/** Применяет изменение только к активному листу (иммутабельно). */
function updateActiveSheet(
    state: AppState,
    patch: (sheet: SheetState) => SheetState
): AppState {
  return {
    ...state,
    sheets: state.sheets.map((s, i) => (i === state.activeSheet ? patch(s) : s))
  }
}

function setOrDelete(
    map: Record<string, string>,
    index: number,
    title: string
): Record<string, string> {
  const next = {...map}
  const t = title.trim()
  if (t === '') {
    delete next[index]
  } else {
    next[index] = t
  }
  return next
}

export function rootReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case TABLE_RESIZE: {
      const field = action.data.type === 'col' ? 'colState' : 'rowState'
      return updateActiveSheet(state, s => ({
        ...s,
        [field]: {...s[field], [action.data.id]: action.data.value}
      }))
    }
    case CHANGE_TEXT:
      return {
        ...updateActiveSheet(state, s => ({
          ...s,
          dataState: {...s.dataState, [action.data.id]: action.data.value}
        })),
        currentText: action.data.value
      }
    case CHANGE_STYLES:
      return {...state, currentStyles: action.data}
    case APPLY_STYLE: {
      const {ids, value} = action.data
      return {
        ...updateActiveSheet(state, s => {
          const stylesState = {...s.stylesState}
          ids.forEach(id => {
            stylesState[id] = {...stylesState[id], ...value}
          })
          return {...s, stylesState}
        }),
        currentStyles: {...state.currentStyles, ...value}
      }
    }
    case CHANGE_TITLE:
      return {...state, title: action.data}
    case UPDATE_DATE:
      return {...state, openedDate: new Date().toJSON()}
    case TABLE_GROW: {
      const field = action.data.axis === 'row' ? 'rowsCount' : 'colsCount'
      return updateActiveSheet(state, s => ({
        ...s,
        [field]: s[field] + action.data.count
      }))
    }
    case TABLE_DELETE:
      return updateActiveSheet(state, s =>
        deleteAxis(s, action.data.axis, action.data.index))
    case TABLE_INSERT:
      return updateActiveSheet(state, s =>
        insertAxis(s, action.data.axis, action.data.index))
    case SET_ACTIVE_SHEET: {
      const idx = action.data
      if (idx < 0 || idx >= state.sheets.length) {
        return state
      }
      return {...state, activeSheet: idx}
    }
    case ADD_SHEET: {
      const name = `Лист${state.sheets.length + 1}`
      return {
        ...state,
        sheets: [...state.sheets, emptySheet(name)],
        activeSheet: state.sheets.length
      }
    }
    case RENAME_SHEET: {
      const name = action.data.name.trim()
      if (!name) {
        return state
      }
      return {
        ...state,
        sheets: state.sheets.map((s, i) =>
          i === action.data.index ? {...s, name} : s)
      }
    }
    case DELETE_SHEET: {
      // последний лист не удаляем — документ не может быть пустым
      if (state.sheets.length <= 1) {
        return state
      }
      const idx = action.data
      const sheets = state.sheets.filter((_, i) => i !== idx)
      const activeSheet = Math.min(state.activeSheet, sheets.length - 1)
      return {...state, sheets, activeSheet}
    }
    case DUPLICATE_SHEET: {
      const idx = action.data
      const src = state.sheets[idx]
      if (!src) {
        return state
      }
      const copy: SheetState = {...clone(src), name: `${src.name} (копия)`}
      const sheets = [
        ...state.sheets.slice(0, idx + 1),
        copy,
        ...state.sheets.slice(idx + 1)
      ]
      return {...state, sheets, activeSheet: idx + 1}
    }
    case IMPORT_SHEETS:
      return {
        ...state,
        title: action.data.title,
        sheets: action.data.sheets.length ? action.data.sheets : [emptySheet()],
        activeSheet: 0
      }
    case SET_COL_TITLE:
      return updateActiveSheet(state, s => ({
        ...s,
        colTitles: setOrDelete(s.colTitles, action.data.index, action.data.title)
      }))
    case SET_ROW_TITLE:
      return updateActiveSheet(state, s => ({
        ...s,
        rowTitles: setOrDelete(s.rowTitles, action.data.index, action.data.title)
      }))
    case ADD_TABLE:
      return updateActiveSheet(state, s => ({
        ...s,
        tables: [...s.tables, {id: genId('tbl'), ...action.data}]
      }))
    case REMOVE_TABLE:
      return updateActiveSheet(state, s => ({
        ...s,
        tables: s.tables.filter(t => t.id !== action.data)
      }))
    case ADD_CHART:
      return updateActiveSheet(state, s => ({
        ...s,
        charts: [...s.charts, {id: genId('cht'), ...action.data}]
      }))
    case REMOVE_CHART:
      return updateActiveSheet(state, s => ({
        ...s,
        charts: s.charts.filter(c => c.id !== action.data)
      }))
    case MOVE_CHART:
      return updateActiveSheet(state, s => ({
        ...s,
        charts: s.charts.map(c =>
          c.id === action.data.id
            ? {...c, x: action.data.x, y: action.data.y}
            : c)
      }))
    case MOVE_TABLE:
      return updateActiveSheet(state, s => {
        const t = s.tables.find(x => x.id === action.data.id)
        if (!t) {
          return s
        }
        const {dRow, dCol} = action.data
        const moved = moveRange(s, t.range, dRow, dCol)
        if (moved === s) {
          return s // смещение за край — no-op
        }
        const range = {
          r1: t.range.r1 + dRow,
          c1: t.range.c1 + dCol,
          r2: t.range.r2 + dRow,
          c2: t.range.c2 + dCol
        }
        return {
          ...moved,
          tables: moved.tables.map(x => (x.id === action.data.id ? {...x, range} : x))
        }
      })
    case PASTE_RANGE:
      return updateActiveSheet(state, s =>
        pasteRange(s, action.data.row, action.data.col, action.data.cells))
    case SET_STATE:
      // полная замена (undo/redo) — состояние уже валидный снимок
      return action.data
    default:
      return state
  }
}
