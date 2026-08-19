import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { MoneyInput } from "./money-input.js"
import { formatMinorAmount, MAX_INT64_MINOR, parseMoneyInput } from "./money.js"

describe("money parser", () => {
  it.each([
    ["1", "100"],
    ["1,2", "120"],
    ["1,20", "120"],
    [" 123,45 ", "12345"],
    ["000123,45", "12345"],
    ["92233720368547758,07", MAX_INT64_MINOR],
  ])("parses %s as exact minor string %s", (display, expected) => {
    expect(parseMoneyInput(display)).toEqual({
      ok: true,
      value: { display, amountMinor: expected },
    })
  })

  it.each([
    ["", "EMPTY"],
    ["0", "ZERO"],
    ["0,00", "ZERO"],
    ["-1", "INVALID_FORMAT"],
    ["+1", "INVALID_FORMAT"],
    ["1.20", "AMBIGUOUS_SEPARATOR"],
    ["1 20", "INVALID_FORMAT"],
    ["1,234", "TOO_MANY_DECIMALS"],
    ["92233720368547758,08", "OVERFLOW"],
  ] as const)("rejects %s with %s", (display, code) => {
    const result = parseMoneyInput(display)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe(code)
  })
})

describe("money formatter", () => {
  it("formats int64 values without converting the whole value to number", () => {
    expect(formatMinorAmount(MAX_INT64_MINOR)).toBe(
      "R$ 92.233.720.368.547.758,07"
    )
  })

  it("formats negative balances exactly", () => {
    expect(formatMinorAmount("-12345")).toBe("-R$ 123,45")
  })
})

describe("MoneyInput", () => {
  it("renders a visible label and a currency prefix", () => {
    const markup = renderToStaticMarkup(
      <MoneyInput id="amount" label="Valor" />
    )
    expect(markup).toContain('for="amount"')
    expect(markup).toContain("Valor")
    expect(markup).toContain("BRL")
  })

  it("connects the input to its description", () => {
    const markup = renderToStaticMarkup(
      <MoneyInput id="amount" label="Valor" description="Valor da operação" />
    )
    expect(markup).toContain('aria-describedby="amount-description"')
    expect(markup).toContain('id="amount-description"')
  })

  it("exposes invalid state and an associated alert", () => {
    const markup = renderToStaticMarkup(
      <MoneyInput id="amount" label="Valor" error="Valor inválido" />
    )
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('id="amount-error"')
    expect(markup).toContain('role="alert"')
  })

  it("combines description and error references", () => {
    const markup = renderToStaticMarkup(
      <MoneyInput id="amount" label="Valor" error="Valor inválido" />
    )
    expect(markup).toContain(
      'aria-describedby="amount-description amount-error"'
    )
  })

  it("preserves disabled state on the input and group", () => {
    const markup = renderToStaticMarkup(
      <MoneyInput id="amount" label="Valor" disabled />
    )
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('data-disabled="true"')
  })

  it("provides the coarse-pointer touch target class", () => {
    const markup = renderToStaticMarkup(
      <MoneyInput id="amount" label="Valor" />
    )
    expect(markup).toContain("touch-target")
  })
})
