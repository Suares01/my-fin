import { invalidQuery } from "./query-validation.js"
export type InvestmentValuationCursor = {
  readonly fingerprint: string
  readonly valuedAt: string
  readonly sequence: string
  readonly id: string
}
export const encodeInvestmentValuationCursor = (v: InvestmentValuationCursor) =>
  `iv1.${encodeURIComponent(JSON.stringify(v))}`
export function decodeInvestmentValuationCursor(
  value: unknown
): InvestmentValuationCursor {
  try {
    if (typeof value !== "string" || !value.startsWith("iv1."))
      throw new Error()
    const v = JSON.parse(decodeURIComponent(value.slice(4))) as Record<
      string,
      unknown
    >
    if (
      ["fingerprint", "valuedAt", "sequence", "id"].some(
        (k) => typeof v[k] !== "string"
      )
    )
      throw new Error()
    return v as InvestmentValuationCursor
  } catch {
    throw invalidQuery("cursor")
  }
}
