import { describe, expect, it } from "vitest"
import { Currency } from "../../shared/identity/currency.js"
import {
  ledgerAccountIdFromString,
  postingIdFromString,
} from "../../shared/identity/ids.js"
import { Money } from "../../shared/money.js"
import { Posting } from "./posting.js"

const usd = Currency.parse("USD")
const accountId = ledgerAccountIdFromString("account-1")

function createPosting() {
  return Posting.create({
    id: postingIdFromString("posting-1"),
    accountId,
    amount: Money.of(1250n, usd),
  })
}

describe("Posting", () => {
  it("rejects a zero amount with the exact domain code", () => {
    expect(() =>
      Posting.create({
        id: postingIdFromString("posting-1"),
        accountId,
        amount: Money.zero(usd),
      })
    ).toThrowError(expect.objectContaining({ code: "ZERO_POSTING_AMOUNT" }))
  })

  it("exposes its identity, account and immutable money", () => {
    const posting = createPosting()

    expect(posting.id).toBe("posting-1")
    expect(posting.accountId).toBe("account-1")
    expect(posting.amount.amountMinor).toBe(1250n)
    expect(posting.amount.currency.code).toBe("USD")
    expect(
      Object.getOwnPropertyDescriptor(Posting.prototype, "amount")
    ).toMatchObject({ get: expect.any(Function), set: undefined })
  })

  it("reverses with a new identity and the exact opposite amount", () => {
    const posting = createPosting()

    const reversal = posting.reverse(postingIdFromString("posting-2"))

    expect(reversal.id).toBe("posting-2")
    expect(reversal.accountId).toBe(accountId)
    expect(reversal.amount.amountMinor).toBe(-1250n)
    expect(reversal.amount.currency.code).toBe("USD")
    expect(posting.amount.amountMinor).toBe(1250n)
  })

  it("serializes and restores the exact primitive values", () => {
    const snapshot = createPosting().toSnapshot()
    const restored = Posting.restore(snapshot)

    expect(snapshot).toEqual({
      id: "posting-1",
      accountId: "account-1",
      amountMinor: 1250n,
      currency: "USD",
    })
    expect(restored.toSnapshot()).toEqual(snapshot)
    expect(restored).not.toBe(createPosting())
  })

  it("does not share a mutable snapshot collection", () => {
    const snapshot = [createPosting().toSnapshot()]
    const restored = Posting.restore(snapshot[0]!)
    snapshot[0] = {
      ...snapshot[0]!,
      amountMinor: 999n,
    }

    expect(restored.amount.amountMinor).toBe(1250n)
  })
})
