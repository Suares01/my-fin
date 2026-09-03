import type { JournalChainDetail } from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  affectedAccountIds,
  amountMinorSchema,
  civilDateSchema,
  descriptionSchema,
  editDraftFromDetail,
  localCivilDate,
  transactionErrorMessage,
  transferDraftSchema,
  validateCancellationDate,
} from "./transaction-form-model.js"

function detail(overrides: Partial<JournalChainDetail> = {}): JournalChainDetail {
  return {
    chainId: "chain-1",
    presentedEntryId: "entry-1",
    presentedVersion: 1,
    type: "INCOME",
    status: "ACTIVE",
    occurredOn: "2026-09-03",
    recordedAt: "2026-09-03T12:00:00.000Z",
    sequence: "1",
    description: "Salário",
    origin: "MANUAL",
    amountMinor: "100",
    currency: "BRL",
    financialAccounts: [{ id: "account-1", name: "Carteira", kind: "ASSET" }],
    categories: [{ id: "category-1", name: "Trabalho", kind: "INCOME" }],
    postings: [],
    history: [],
    ...overrides,
  }
}

describe("transaction form model", () => {
  it("accepts the positive minor-unit amount boundaries", () => {
    expect(amountMinorSchema.parse("1")).toBe("1")
    expect(amountMinorSchema.parse("9223372036854775807")).toBe("9223372036854775807")
  })

  it("rejects zero, fractional, negative, and overflowing amounts", () => {
    for (const value of ["0", "1.5", "-1", "9223372036854775808"]) {
      expect(amountMinorSchema.safeParse(value).success).toBe(false)
    }
  })

  it("trims a nonempty description", () => {
    expect(descriptionSchema.parse("  Mercado  ")).toBe("Mercado")
    expect(descriptionSchema.safeParse("  ").success).toBe(false)
  })

  it("accepts a valid leap-year civil date", () => {
    expect(civilDateSchema.parse("2024-02-29")).toBe("2024-02-29")
  })

  it("rejects malformed and impossible civil dates", () => {
    expect(civilDateSchema.safeParse("2026-02-29").success).toBe(false)
    expect(civilDateSchema.safeParse("03/09/2026").success).toBe(false)
  })

  it("formats the local calendar date without UTC conversion", () => {
    expect(localCivilDate(new Date(2026, 8, 3, 23, 30))).toBe("2026-09-03")
  })

  it("rejects a transfer with equal source and destination accounts", () => {
    const result = transferDraftSchema.safeParse({
      type: "TRANSFER",
      sourceAccountId: "account-1",
      destinationAccountId: "account-1",
      amountMinor: "1",
      currency: "BRL",
      occurredOn: "2026-09-03",
      description: "Mover",
    })
    expect(result.error?.issues[0]?.message).toBe("Escolha contas diferentes.")
  })

  it("rejects a cancellation date before the presented occurrence", () => {
    expect(validateCancellationDate("2026-09-02", "2026-09-03")).toBe(
      "A data de cancelamento não pode ser anterior ao lançamento."
    )
  })

  it("maps an income detail to the same-type edit draft", () => {
    expect(editDraftFromDetail(detail())).toEqual({
      ok: true,
      draft: {
        type: "INCOME",
        accountId: "account-1",
        categoryId: "category-1",
        amountMinor: "100",
        currency: "BRL",
        occurredOn: "2026-09-03",
        description: "Salário",
      },
    })
  })

  it("maps an expense detail to the same-type edit draft", () => {
    expect(editDraftFromDetail(detail({ type: "EXPENSE" }))).toMatchObject({
      ok: true,
      draft: { type: "EXPENSE", accountId: "account-1", categoryId: "category-1" },
    })
  })

  it("maps a transfer detail to its source and destination draft", () => {
    expect(
      editDraftFromDetail(
        detail({
          type: "TRANSFER",
          categories: [],
          transfer: {
            source: { id: "source", name: "Origem", kind: "ASSET" },
            destination: { id: "destination", name: "Destino", kind: "LIABILITY" },
          },
        })
      )
    ).toMatchObject({
      ok: true,
      draft: { type: "TRANSFER", sourceAccountId: "source", destinationAccountId: "destination" },
    })
  })

  it("blocks editing when a projected account or category is ambiguous", () => {
    expect(
      editDraftFromDetail(
        detail({ financialAccounts: [], categories: [{ id: "category-1", name: "Trabalho", kind: "INCOME" }] })
      )
    ).toEqual({ ok: false, reason: "AMBIGUOUS_DETAIL" })
  })

  it("derives the affected-account union without changing stable identifiers", () => {
    expect(
      affectedAccountIds(
        {
          type: "TRANSFER",
          sourceAccountId: "account-2",
          destinationAccountId: "account-3",
          amountMinor: "100",
          currency: "BRL",
          occurredOn: "2026-09-03",
          description: "Mover",
        },
        detail()
      )
    ).toEqual(["account-1", "account-2", "account-3"])
  })

  it("translates known domain failures into safe Portuguese feedback", () => {
    expect(transactionErrorMessage({ code: "INVALID_ACCOUNT_STATUS", id: "account-1" })).toBe(
      "A conta ou categoria selecionada não está ativa."
    )
  })
})
