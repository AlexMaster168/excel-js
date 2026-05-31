import {clone} from '@core/utils'
import {
  defaultCols,
  defaultRows,
  defaultSheetName,
  defaultStyles,
  defaultTitle
} from '@/constants'
import type {AppState, SheetState} from '@/redux/types'

/** Пустой лист с дефолтными размерами. */
export function emptySheet(name = defaultSheetName): SheetState {
  return {
    name,
    dataState: {},
    stylesState: {},
    rowState: {},
    colState: {},
    rowsCount: defaultRows,
    colsCount: defaultCols,
    colTitles: {},
    rowTitles: {},
    tables: [],
    charts: []
  }
}

const defaultState: AppState = {
  title: defaultTitle,
  openedDate: new Date().toJSON(),
  currentText: '',
  currentStyles: defaultStyles,
  activeSheet: 0,
  sheets: [emptySheet()]
}

/** Дополняет лист недостающими полями (миграция). */
function normalizeSheet(s: Partial<SheetState>, index: number): SheetState {
  const name = s.name || `Лист${index + 1}`
  return {
    ...emptySheet(name),
    ...s,
    name
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(state: any): AppState {
  let sheets: SheetState[]
  if (Array.isArray(state.sheets) && state.sheets.length) {
    sheets = state.sheets.map((s: Partial<SheetState>, i: number) => normalizeSheet(s, i))
  } else if (state.dataState || state.colState || state.rowState) {
    // старый одно-листовый формат -> мигрируем в один лист
    sheets = [normalizeSheet({
      name: defaultSheetName,
      dataState: state.dataState,
      stylesState: state.stylesState,
      rowState: state.rowState,
      colState: state.colState,
      rowsCount: state.rowsCount,
      colsCount: state.colsCount
    }, 0)]
  } else {
    sheets = [emptySheet()]
  }
  const activeSheet = typeof state.activeSheet === 'number' &&
    state.activeSheet >= 0 && state.activeSheet < sheets.length
    ? state.activeSheet
    : 0
  return {
    title: state.title || defaultTitle,
    openedDate: state.openedDate || new Date().toJSON(),
    currentText: '',
    currentStyles: defaultStyles,
    activeSheet,
    sheets
  }
}

export function normalizeInitialState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: AppState | any | null | undefined
): AppState {
  return state ? normalize(state) : clone(defaultState)
}
