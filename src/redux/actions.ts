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
import type {
  Action,
  AddChartData,
  AddTableData,
  AppState,
  ApplyStyleData,
  AxisIndexData,
  CellStyles,
  ChangeTextData,
  GrowData,
  MoveChartData,
  MoveTableData,
  PasteRangeData,
  RenameSheetData,
  ResizeData,
  SetTitleData,
  SheetState
} from '@/redux/types'

export function tableResize(data: ResizeData): Action {
  return {type: TABLE_RESIZE, data}
}

export function updateDate(): Action {
  return {type: UPDATE_DATE}
}

export function changeText(data: ChangeTextData): Action {
  return {type: CHANGE_TEXT, data}
}

export function changeStyles(data: CellStyles): Action {
  return {type: CHANGE_STYLES, data}
}

export function applyStyle(data: ApplyStyleData): Action {
  return {type: APPLY_STYLE, data}
}

export function changeTitle(data: string): Action {
  return {type: CHANGE_TITLE, data}
}

export function tableGrow(data: GrowData): Action {
  return {type: TABLE_GROW, data}
}

export function tableDelete(data: AxisIndexData): Action {
  return {type: TABLE_DELETE, data}
}

export function tableInsert(data: AxisIndexData): Action {
  return {type: TABLE_INSERT, data}
}

export function setActiveSheet(index: number): Action {
  return {type: SET_ACTIVE_SHEET, data: index}
}

export function addSheet(): Action {
  return {type: ADD_SHEET}
}

export function renameSheet(data: RenameSheetData): Action {
  return {type: RENAME_SHEET, data}
}

export function deleteSheet(index: number): Action {
  return {type: DELETE_SHEET, data: index}
}

export function duplicateSheet(index: number): Action {
  return {type: DUPLICATE_SHEET, data: index}
}

export function importSheets(data: {title: string; sheets: SheetState[]}): Action {
  return {type: IMPORT_SHEETS, data}
}

export function setColTitle(data: SetTitleData): Action {
  return {type: SET_COL_TITLE, data}
}

export function setRowTitle(data: SetTitleData): Action {
  return {type: SET_ROW_TITLE, data}
}

let idCounter = 0

/** Уникальный id для объектов-таблиц и графиков. */
export function genId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${(idCounter++).toString(36)}`
}

export function addTable(data: AddTableData): Action {
  return {type: ADD_TABLE, data}
}

export function removeTable(id: string): Action {
  return {type: REMOVE_TABLE, data: id}
}

export function addChart(data: AddChartData): Action {
  return {type: ADD_CHART, data}
}

export function removeChart(id: string): Action {
  return {type: REMOVE_CHART, data: id}
}

export function moveChart(data: MoveChartData): Action {
  return {type: MOVE_CHART, data}
}

export function moveTable(data: MoveTableData): Action {
  return {type: MOVE_TABLE, data}
}

export function pasteRange(data: PasteRangeData): Action {
  return {type: PASTE_RANGE, data}
}

/** Полная замена состояния (используется undo/redo). */
export function setState(state: AppState): Action {
  return {type: SET_STATE, data: state}
}
