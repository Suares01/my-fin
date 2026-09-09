import { describe, expect, it } from "vitest"
import {
  incomeFormSchema,
  expenseFormSchema,
  transferFormSchema,
  initialValueCents,
} from "./transaction-form-schema"
import { amountMinorSchema } from "./transaction-form-model"

const shared = {
  valueCents: 1234,
  currency: "USD",
  occurredOn: "2026-09-03",
  description: "  Mercado  ",
}
describe("transaction form schemas", () => {
  it.each(["INCOME", "EXPENSE"] as const)(
    "converts %s to its existing public draft",
    (type) => {
      const schema = type === "INCOME" ? incomeFormSchema : expenseFormSchema
      expect(
        schema.parse({ type, accountId: "a1", categoryId: "c1", ...shared })
      ).toEqual({
        type,
        accountId: "a1",
        categoryId: "c1",
        amountMinor: "1234",
        currency: "USD",
        occurredOn: "2026-09-03",
        description: "Mercado",
      })
    }
  )
  it("converts transfers and reports equal accounts at the destination", () => {
    const values = {
      type: "TRANSFER",
      sourceAccountId: "a1",
      destinationAccountId: "a2",
      ...shared,
    }
    expect(transferFormSchema.parse(values)).toEqual({
      type: "TRANSFER",
      sourceAccountId: "a1",
      destinationAccountId: "a2",
      amountMinor: "1234",
      currency: "USD",
      occurredOn: "2026-09-03",
      description: "Mercado",
    })
    const result = transferFormSchema.safeParse({
      ...values,
      destinationAccountId: "a1",
    })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["destinationAccountId"] })
      )
  })
  it.each([0, -1, 1.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid cents: %s",
    (valueCents) => {
      expect(
        incomeFormSchema.safeParse({
          type: "INCOME",
          accountId: "a1",
          categoryId: "c1",
          ...shared,
          valueCents,
        }).success
      ).toBe(false)
    }
  )
  it.each([1, Number.MAX_SAFE_INTEGER])(
    "preserves safe cents exactly: %s",
    (valueCents) => {
      expect(
        incomeFormSchema.parse({
          type: "INCOME",
          accountId: "a1",
          categoryId: "c1",
          ...shared,
          valueCents,
        }).amountMinor
      ).toBe(String(valueCents))
    }
  )
  it("guards initial conversion without reducing the domain's int64 limit", () => {
    expect(initialValueCents()).toBe(0)
    expect(initialValueCents("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER)
    expect(initialValueCents("9007199254740992")).toBeNull()
    expect(initialValueCents("9223372036854775807")).toBeNull()
    expect(amountMinorSchema.parse("9223372036854775807")).toBe(
      "9223372036854775807"
    )
  })
  it.each(["2026-02-30", "2026-13-01", "", "2026-2-03"])(
    "rejects invalid civil date %s",
    (occurredOn) => {
      expect(
        incomeFormSchema.safeParse({
          type: "INCOME",
          accountId: "a1",
          categoryId: "c1",
          ...shared,
          occurredOn,
        }).success
      ).toBe(false)
    }
  )
})
