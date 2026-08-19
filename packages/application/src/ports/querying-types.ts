declare const yearMonthBrand: unique symbol

export type YearMonth = string & {
  readonly [yearMonthBrand]: "YearMonth"
}
