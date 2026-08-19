import { LedgerAccount } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import {
  InMemoryLedgerAccountRepository,
  ledgerAccountSnapshot,
} from "./in-memory-ledger-account-repository.js"
import { InMemoryStore } from "../store/in-memory-store.js"

function account(overrides: Parameters<typeof ledgerAccountSnapshot>[0] = {}) {
  return LedgerAccount.restore(ledgerAccountSnapshot(overrides))
}

describe("InMemoryLedgerAccountRepository", () => {
  it("adds and rehydrates independent accounts", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())
    const original = account()
    await repository.add(original)

    const loaded = await repository.findById(original.id)

    expect(loaded).not.toBe(original)
    expect(loaded?.toSnapshot()).toEqual(original.toSnapshot())
  })

  it("returns null for an unknown account or system purpose", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())

    expect(await repository.findById("missing" as never)).toBeNull()
    expect(
      await repository.findBySystemPurpose("book-1" as never, "OPENING_BALANCE")
    ).toBeNull()
  })

  it("finds an account by book, kind and normalized name", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())
    await repository.add(account())
    await repository.add(
      account({
        id: "account-2" as never,
        bookId: "book-2" as never,
      })
    )

    expect(
      await repository.existsWithName("book-1" as never, "ASSET", "cash")
    ).toBe(true)
    expect(
      await repository.existsWithName("book-2" as never, "ASSET", "cash")
    ).toBe(true)
    expect(
      await repository.existsWithName("book-1" as never, "LIABILITY", "cash")
    ).toBe(false)
    expect(
      await repository.existsWithName("book-1" as never, "ASSET", "Cash")
    ).toBe(false)
  })

  it("excludes the target account while retaining another same-kind conflict", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())
    await repository.add(account())
    await repository.add(
      account({
        id: "account-2" as never,
        name: "Cash",
        normalizedName: "cash",
      })
    )

    expect(
      await repository.existsWithName(
        "book-1" as never,
        "ASSET",
        "cash",
        "account-1" as never
      )
    ).toBe(true)
    expect(
      await repository.existsWithName(
        "book-1" as never,
        "ASSET",
        "cash",
        "account-2" as never
      )
    ).toBe(true)
    expect(
      await repository.existsWithName(
        "book-1" as never,
        "ASSET",
        "cash",
        "account-3" as never
      )
    ).toBe(true)
  })

  it("finds a system account only in its book and purpose", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())
    await repository.add(
      account({
        systemPurpose: "OPENING_BALANCE",
        name: "Opening",
        normalizedName: "opening",
        kind: "EQUITY",
      })
    )

    expect(
      (
        await repository.findBySystemPurpose(
          "book-1" as never,
          "OPENING_BALANCE"
        )
      )?.id
    ).toBe("account-1")
    expect(
      await repository.findBySystemPurpose("book-2" as never, "OPENING_BALANCE")
    ).toBeNull()
  })

  it("rejects duplicate IDs and duplicate system purposes", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())
    await repository.add(account())

    await expect(repository.add(account())).rejects.toMatchObject({
      code: "DUPLICATE_ENTITY",
    })
    await repository.add(
      account({
        id: "account-2" as never,
        systemPurpose: "OPENING_BALANCE",
      })
    )
    await expect(
      repository.add(
        account({ id: "account-3" as never, systemPurpose: "OPENING_BALANCE" })
      )
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
  })

  it("saves an account at the exact next version", async () => {
    const store = new InMemoryStore()
    const repository = new InMemoryLedgerAccountRepository(store)
    await repository.add(account())
    const updated = account({
      name: "Wallet",
      normalizedName: "wallet",
      version: 1,
    })
    await repository.save(updated, 0)

    expect((await repository.findById(updated.id))?.toSnapshot()).toEqual(
      ledgerAccountSnapshot({
        name: "Wallet",
        normalizedName: "wallet",
        version: 1,
      })
    )
  })

  it("round-trips renamed and reactivated snapshots without changing identity or kind", async () => {
    const store = new InMemoryStore()
    const repository = new InMemoryLedgerAccountRepository(store)
    await repository.add(account())

    await repository.save(
      account({
        name: "Reserve",
        normalizedName: "reserve",
        status: "ARCHIVED",
        version: 1,
      }),
      0
    )
    await repository.save(
      account({
        name: "Reserva",
        normalizedName: "reserva",
        status: "ACTIVE",
        version: 2,
      }),
      1
    )

    expect(
      (await repository.findById("account-1" as never))?.toSnapshot()
    ).toEqual(
      ledgerAccountSnapshot({
        name: "Reserva",
        normalizedName: "reserva",
        status: "ACTIVE",
        version: 2,
      })
    )
  })

  it("rejects a version conflict and preserves the stored account", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())
    await repository.add(account())
    const invalid = account({
      name: "Invalid",
      normalizedName: "invalid",
      version: 2,
    })

    await expect(repository.save(invalid, 0)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    expect(
      (await repository.findById("account-1" as never))?.toSnapshot()
    ).toEqual(ledgerAccountSnapshot())
  })

  it("rejects changing the persisted account kind", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())
    await repository.add(account())

    await expect(
      repository.save(account({ kind: "LIABILITY", version: 1 }), 0)
    ).rejects.toMatchObject({ code: "IMMUTABLE_ACCOUNT_KIND" })
    expect((await repository.findById("account-1" as never))?.kind).toBe(
      "ASSET"
    )
  })

  it("rejects saving a missing account", async () => {
    const repository = new InMemoryLedgerAccountRepository(new InMemoryStore())

    await expect(
      repository.save(account({ version: 1 }), 0)
    ).rejects.toMatchObject({
      code: "ENTITY_NOT_FOUND",
    })
  })
})
