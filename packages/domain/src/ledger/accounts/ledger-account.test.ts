import { describe, expect, it } from "vitest"
import {
  isCategoryAccount,
  isFinancialAccount,
  LedgerAccount,
  normalBalanceOf,
  normalizeAccountName,
} from "./ledger-account.js"
import {
  bookIdFromString,
  ledgerAccountIdFromString,
} from "../../shared/identity/ids.js"

const bookId = bookIdFromString("book-1")

function createAccount(
  kind: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY" = "ASSET"
) {
  return LedgerAccount.create({
    id: ledgerAccountIdFromString(`account-${kind}`),
    bookId,
    name: "  Caixa  ",
    kind,
    ...(kind === "INCOME" || kind === "EXPENSE"
      ? { iconKey: "label-dollar", colorHex: "f43f5e" }
      : {}),
  })
}

describe("LedgerAccount", () => {
  it.each([
    ["ASSET", "DEBIT"],
    ["EXPENSE", "DEBIT"],
    ["LIABILITY", "CREDIT"],
    ["INCOME", "CREDIT"],
    ["EQUITY", "CREDIT"],
  ] as const)("returns %s normal balance as %s", (kind, expected) => {
    expect(normalBalanceOf(kind)).toBe(expected)
  })

  it("classifies financial and category accounts", () => {
    expect(isFinancialAccount(createAccount("ASSET"))).toBe(true)
    expect(isFinancialAccount(createAccount("LIABILITY"))).toBe(true)
    expect(isFinancialAccount(createAccount("INCOME"))).toBe(false)
    expect(isCategoryAccount(createAccount("INCOME"))).toBe(true)
    expect(isCategoryAccount(createAccount("EXPENSE"))).toBe(true)
    expect(isCategoryAccount(createAccount("EQUITY"))).toBe(false)
  })

  it("trims and normalizes the account name", () => {
    const account = LedgerAccount.create({
      id: ledgerAccountIdFromString("account-1"),
      bookId,
      name: "  Café  ",
      kind: "ASSET",
    })

    expect(account.name).toBe("Café")
    expect(account.normalizedName).toBe("café")
    expect(normalizeAccountName("  CAFÉ  ")).toBe("café")
  })

  it("starts active at version zero with no system purpose", () => {
    const account = createAccount()

    expect(account.status).toBe("ACTIVE")
    expect(account.version).toBe(0)
    expect(account.systemPurpose).toBeUndefined()
  })

  it("rejects an empty name with a stable error", () => {
    expect(() =>
      LedgerAccount.create({
        id: ledgerAccountIdFromString("account-1"),
        bookId,
        name: " ",
        kind: "ASSET",
      })
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACCOUNT_NAME" }))
  })

  it("creates a system account with its protected purpose", () => {
    const account = LedgerAccount.create({
      id: ledgerAccountIdFromString("opening"),
      bookId,
      name: "Opening balance",
      kind: "EQUITY",
      systemPurpose: "OPENING_BALANCE",
    })

    expect(account.systemPurpose).toBe("OPENING_BALANCE")
    expect(account.toSnapshot().systemPurpose).toBe("OPENING_BALANCE")
  })

  it("archives a non-system account and increments its version", () => {
    const account = createAccount()

    account.archive()

    expect(account.status).toBe("ARCHIVED")
    expect(account.version).toBe(1)
  })

  it("renames an account while preserving its identity and kind", () => {
    const account = createAccount("ASSET")
    account.pullDomainFacts()

    account.rename("  Carteira Principal  ")

    expect(account.toSnapshot()).toMatchObject({
      id: "account-ASSET",
      bookId: "book-1",
      name: "Carteira Principal",
      normalizedName: "carteira principal",
      kind: "ASSET",
      status: "ACTIVE",
      version: 1,
    })
    expect(account.pullDomainFacts()).toEqual([
      expect.objectContaining({
        type: "LedgerAccountRenamed",
        aggregateVersion: 1,
        payload: expect.objectContaining({
          bookId: "book-1",
          kind: "ASSET",
          name: "Carteira Principal",
          status: "ACTIVE",
        }),
      }),
    ])
  })

  it("treats the current display name as a rename no-op", () => {
    const account = createAccount()
    const before = account.toSnapshot()

    account.rename("Caixa")

    expect(account.toSnapshot()).toEqual(before)
    expect(account.pullDomainFacts()).toHaveLength(1)
  })

  it("allows a case-only or spacing-normalized rename", () => {
    const account = createAccount()
    account.pullDomainFacts()

    account.rename("  CAIXA  ")

    expect(account.name).toBe("CAIXA")
    expect(account.normalizedName).toBe("caixa")
    expect(account.version).toBe(1)
  })

  it("rejects an empty rename without mutation", () => {
    const account = createAccount()
    const before = account.toSnapshot()
    account.pullDomainFacts()

    expect(() => account.rename("  ")).toThrowError(
      expect.objectContaining({ code: "INVALID_ACCOUNT_NAME" })
    )
    expect(account.toSnapshot()).toEqual(before)
    expect(account.pullDomainFacts()).toEqual([])
  })

  it("does not increment version when archiving an archived account", () => {
    const account = createAccount()
    account.archive()

    account.archive()

    expect(account.version).toBe(1)
  })

  it("reactivates an archived account with one version transition", () => {
    const account = createAccount()
    account.archive()
    account.pullDomainFacts()

    account.reactivate()

    expect(account.status).toBe("ACTIVE")
    expect(account.version).toBe(2)
    expect(account.pullDomainFacts()).toEqual([
      expect.objectContaining({
        type: "LedgerAccountReactivated",
        aggregateVersion: 2,
        payload: expect.objectContaining({ status: "ACTIVE", kind: "ASSET" }),
      }),
    ])
  })

  it("does not change an active account when reactivated", () => {
    const account = createAccount()
    const before = account.toSnapshot()

    account.reactivate()

    expect(account.toSnapshot()).toEqual(before)
    expect(account.pullDomainFacts()).toHaveLength(1)
  })

  it("does not expose a mutator for the account kind", () => {
    const account = createAccount("ASSET")

    expect(
      Object.getOwnPropertyDescriptor(LedgerAccount.prototype, "changeKind")
    ).toBeUndefined()
    expect(account.kind).toBe("ASSET")
    expect(account.version).toBe(0)
  })

  it("protects system accounts from archiving without mutation", () => {
    const account = LedgerAccount.create({
      id: ledgerAccountIdFromString("system"),
      bookId,
      name: "System",
      kind: "EQUITY",
      systemPurpose: "OPENING_BALANCE",
    })
    const before = account.toSnapshot()

    expect(() => account.archive()).toThrowError(
      expect.objectContaining({ code: "SYSTEM_ACCOUNT_PROTECTED" })
    )
    expect(account.toSnapshot()).toEqual(before)
  })

  it.each(["rename", "archive", "reactivate"] as const)(
    "protects system accounts from %s",
    (action) => {
      const account = LedgerAccount.create({
        id: ledgerAccountIdFromString(`system-${action}`),
        bookId,
        name: "System",
        kind: "EQUITY",
        systemPurpose: "OPENING_BALANCE",
      })
      const before = account.toSnapshot()
      account.pullDomainFacts()

      expect(() => {
        if (action === "rename") account.rename("Other")
        if (action === "archive") account.archive()
        if (action === "reactivate") account.reactivate()
      }).toThrowError(
        expect.objectContaining({ code: "SYSTEM_ACCOUNT_PROTECTED" })
      )
      expect(account.toSnapshot()).toEqual(before)
      expect(account.pullDomainFacts()).toEqual([])
    }
  )

  it("round trips every field without restoring pending facts", () => {
    const account = LedgerAccount.create({
      id: ledgerAccountIdFromString("system"),
      bookId,
      name: "System",
      kind: "EQUITY",
      systemPurpose: "OPENING_BALANCE",
    })
    account.pullDomainFacts()
    const snapshot = {
      ...account.toSnapshot(),
      status: "ACTIVE" as const,
      version: 3,
    }

    const restored = LedgerAccount.restore(snapshot)

    expect(restored.toSnapshot()).toEqual(snapshot)
    expect(restored.pullDomainFacts()).toEqual([])
  })

  it("records a version-zero creation fact", () => {
    const account = createAccount()

    expect(account.pullDomainFacts()).toEqual([
      expect.objectContaining({
        type: "LedgerAccountCreated",
        aggregateId: "account-ASSET",
        aggregateVersion: 0,
        payload: expect.objectContaining({ version: 0 }),
      }),
    ])
  })

  it("exposes immutable properties through getters", () => {
    const account = createAccount()

    expect(
      Object.getOwnPropertyDescriptor(LedgerAccount.prototype, "kind")
    ).toMatchObject({ get: expect.any(Function), set: undefined })
    expect(account.kind).toBe("ASSET")
  })
})
