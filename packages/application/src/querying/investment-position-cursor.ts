import { invalidQuery } from "./query-validation.js"

export type InvestmentPositionCursor = {
  readonly fingerprint: string
  readonly name: string
  readonly label: string
  readonly id: string
}
export function encodeInvestmentPositionCursor(
  value: InvestmentPositionCursor
): string {
  return `ip1.${encodeURIComponent(JSON.stringify(value))}`
}
export function decodeInvestmentPositionCursor(
  value: unknown
): InvestmentPositionCursor {
  if (typeof value !== "string" || !value.startsWith("ip1."))
    throw invalidQuery("cursor")
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value.slice(4)))
    if (typeof parsed !== "object" || parsed === null) throw new Error()
    const item = parsed as Record<string, unknown>
    if (
      ["fingerprint", "name", "label", "id"].some(
        (key) => typeof item[key] !== "string"
      )
    )
      throw new Error()
    return item as InvestmentPositionCursor
  } catch {
    throw invalidQuery("cursor")
  }
}
