import { invalidQuery } from "./query-validation.js"
export type InvestmentOperationCursor = {
  readonly fingerprint: string
  readonly occurredOn: string
  readonly sequence: string
  readonly id: string
}
export const encodeInvestmentOperationCursor = (
  value: InvestmentOperationCursor
) => `io1.${encodeURIComponent(JSON.stringify(value))}`
export function decodeInvestmentOperationCursor(
  value: unknown
): InvestmentOperationCursor {
  try {
    if (typeof value !== "string" || !value.startsWith("io1."))
      throw new Error()
    const item = JSON.parse(decodeURIComponent(value.slice(4))) as Record<
      string,
      unknown
    >
    if (
      ["fingerprint", "occurredOn", "sequence", "id"].some(
        (k) => typeof item[k] !== "string"
      )
    )
      throw new Error()
    return item as InvestmentOperationCursor
  } catch {
    throw invalidQuery("cursor")
  }
}
