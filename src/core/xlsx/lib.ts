// Единая точка загрузки SheetJS. Используем форк xlsx-js-style: API тот же, но он умеет
// писать стили ячеек. Грузится лениво — не попадает в основной бандл.

import type * as XLSXTypes from 'xlsx-js-style'

export type XlsxLib = typeof XLSXTypes

export async function loadXlsx(): Promise<XlsxLib> {
  const mod = await import('xlsx-js-style')
  // CJS-пакет: в зависимости от сборщика API лежит в default или в самом модуле
  return ((mod as unknown as {default?: XlsxLib}).default ?? mod) as XlsxLib
}
