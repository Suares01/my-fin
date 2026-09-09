import { DomainError } from "../../shared/kernel/domain-error.js"

export interface CategoryAppearance {
  readonly iconKey: string
  readonly colorHex: string
}

const CATEGORY_ICON_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CATEGORY_COLOR_HEX = /^[0-9a-fA-F]{6}$/

export function categoryAppearance(
  input: CategoryAppearance
): CategoryAppearance {
  if (!CATEGORY_ICON_KEY.test(input.iconKey)) {
    throw new DomainError(
      "INVALID_CATEGORY_ICON_KEY",
      "Category icon key must be a lowercase slug"
    )
  }

  if (!CATEGORY_COLOR_HEX.test(input.colorHex)) {
    throw new DomainError(
      "INVALID_CATEGORY_COLOR",
      "Category color must be a six-digit hexadecimal value"
    )
  }

  return {
    iconKey: input.iconKey,
    colorHex: input.colorHex.toLowerCase(),
  }
}
