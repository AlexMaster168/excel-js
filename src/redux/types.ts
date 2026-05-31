// Константы типов экшенов. `as const`-литералы дают точные типы для discriminated union.
export const TABLE_RESIZE = 'TABLE_RESIZE'
export const CHANGE_TEXT = 'CHANGE_TEXT'
export const APPLY_STYLE = 'APPLY_STYLE'
export const CHANGE_STYLES = 'CHANGE_STYLES'
export const CHANGE_TITLE = 'CHANGE_TITLE'
export const UPDATE_DATE = 'UPDATE_DATE'
export const TABLE_GROW = 'TABLE_GROW'
export const TABLE_DELETE = 'TABLE_DELETE'
export const TABLE_INSERT = 'TABLE_INSERT'
export const SET_ACTIVE_SHEET = 'SET_ACTIVE_SHEET'
export const ADD_SHEET = 'ADD_SHEET'
export const RENAME_SHEET = 'RENAME_SHEET'
export const DELETE_SHEET = 'DELETE_SHEET'
export const DUPLICATE_SHEET = 'DUPLICATE_SHEET'
export const IMPORT_SHEETS = 'IMPORT_SHEETS'
export const SET_COL_TITLE = 'SET_COL_TITLE'
export const SET_ROW_TITLE = 'SET_ROW_TITLE'
export const ADD_TABLE = 'ADD_TABLE'
export const REMOVE_TABLE = 'REMOVE_TABLE'
export const MOVE_TABLE = 'MOVE_TABLE'
export const ADD_CHART = 'ADD_CHART'
export const REMOVE_CHART = 'REMOVE_CHART'
export const MOVE_CHART = 'MOVE_CHART'
export const PASTE_RANGE = 'PASTE_RANGE'
export const SET_STATE = 'SET_STATE'

/** Инлайновые стили ячейки. */
export interface CellStyles {
  textAlign?: string
  fontWeight?: string
  textDecoration?: string
  fontStyle?: string
  color?: string
  backgroundColor?: string
  fontSize?: string
}

/** Идентификатор ячейки в формате "row:col" (например "2:3"). */
export type CellId = string

/** Прямоугольный диапазон ячеек (0-based, включительно). */
export interface CellRange {
  r1: number
  c1: number
  r2: number
  c2: number
}

/** Именованная таблица-объект внутри листа (оформление диапазона). */
export interface TableObject {
  id: string
  name: string
  range: CellRange
}

export type ChartType = 'bar' | 'line' | 'pie'

/** График-объект внутри листа, строится по диапазону. x/y — позиция карточки. */
export interface ChartObject {
  id: string
  type: ChartType
  title: string
  range: CellRange
  x?: number
  y?: number
}

/** Состояние одного листа таблицы. */
export interface SheetState {
  name: string
  dataState: Record<CellId, string>
  stylesState: Record<CellId, CellStyles>
  rowState: Record<string, number>
  colState: Record<string, number>
  rowsCount: number
  colsCount: number
  colTitles: Record<string, string>
  rowTitles: Record<string, string>
  tables: TableObject[]
  charts: ChartObject[]
}

/** Документ: несколько листов + общие поля. */
export interface AppState {
  title: string
  openedDate: string
  currentText: string
  currentStyles: CellStyles
  activeSheet: number
  sheets: SheetState[]
}

// --- Полезные нагрузки экшенов ---

export interface ResizeData {
  value: number
  type: 'col' | 'row'
  id: string
}

export interface ChangeTextData {
  id: CellId
  value: string
}

export interface ApplyStyleData {
  value: CellStyles
  ids: CellId[]
}

export interface GrowData {
  axis: 'row' | 'col'
  count: number
}

/** Удаление/вставка строки или столбца по индексу (0-based). */
export interface AxisIndexData {
  axis: 'row' | 'col'
  index: number
}

export interface SetTitleData {
  index: number
  title: string
}

export interface RenameSheetData {
  index: number
  name: string
}

export interface AddTableData {
  name: string
  range: CellRange
}

export interface AddChartData {
  type: ChartType
  title: string
  range: CellRange
}

export interface MoveChartData {
  id: string
  x: number
  y: number
}

/** Перемещение таблицы-объекта на смещение в ячейках. */
export interface MoveTableData {
  id: string
  dRow: number
  dCol: number
}

/** Ячейка буфера обмена: сырое значение + (опционально) стили. */
export interface ClipCell {
  value: string
  style?: CellStyles
}

/** Вставка прямоугольного блока ячеек начиная с (row, col). */
export interface PasteRangeData {
  row: number
  col: number
  cells: ClipCell[][]
}

// --- Discriminated union всех экшенов ---

export type Action =
  | {type: typeof TABLE_RESIZE; data: ResizeData}
  | {type: typeof CHANGE_TEXT; data: ChangeTextData}
  | {type: typeof CHANGE_STYLES; data: CellStyles}
  | {type: typeof APPLY_STYLE; data: ApplyStyleData}
  | {type: typeof CHANGE_TITLE; data: string}
  | {type: typeof UPDATE_DATE}
  | {type: typeof TABLE_GROW; data: GrowData}
  | {type: typeof TABLE_DELETE; data: AxisIndexData}
  | {type: typeof TABLE_INSERT; data: AxisIndexData}
  | {type: typeof SET_ACTIVE_SHEET; data: number}
  | {type: typeof ADD_SHEET}
  | {type: typeof RENAME_SHEET; data: RenameSheetData}
  | {type: typeof DELETE_SHEET; data: number}
  | {type: typeof DUPLICATE_SHEET; data: number}
  | {type: typeof IMPORT_SHEETS; data: {title: string; sheets: SheetState[]}}
  | {type: typeof SET_COL_TITLE; data: SetTitleData}
  | {type: typeof SET_ROW_TITLE; data: SetTitleData}
  | {type: typeof ADD_TABLE; data: AddTableData}
  | {type: typeof REMOVE_TABLE; data: string}
  | {type: typeof MOVE_TABLE; data: MoveTableData}
  | {type: typeof ADD_CHART; data: AddChartData}
  | {type: typeof REMOVE_CHART; data: string}
  | {type: typeof MOVE_CHART; data: MoveChartData}
  | {type: typeof PASTE_RANGE; data: PasteRangeData}
  | {type: typeof SET_STATE; data: AppState}
