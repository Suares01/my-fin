import {
  ApplicationError,
  type DomainFactCollector,
  type LedgerAccountRepository,
} from "@workspace/application"
import {
  LedgerAccount,
  type BookId,
  type LedgerAccountId,
  type LedgerAccountKind,
  type LedgerAccountSnapshot,
  type SystemAccountPurpose,
} from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryLedgerAccountRepository implements LedgerAccountRepository {
  constructor(
    private readonly store: InMemoryStore,
    private readonly facts?: DomainFactCollector
  ) {}

  async findById(id: LedgerAccountId): Promise<LedgerAccount | null> {
    const snapshot = this.store.getAccount(id)
    return snapshot === undefined ? null : LedgerAccount.restore(snapshot)
  }

  async findBySystemPurpose(
    bookId: BookId,
    purpose: SystemAccountPurpose
  ): Promise<LedgerAccount | null> {
    const snapshot = this.store
      .listAccounts()
      .find(
        (account) =>
          account.bookId === bookId && account.systemPurpose === purpose
      )
    return snapshot === undefined ? null : LedgerAccount.restore(snapshot)
  }

  async existsWithName(
    bookId: BookId,
    kind: LedgerAccountKind,
    normalizedName: string,
    excludeAccountId?: LedgerAccountId
  ): Promise<boolean> {
    return this.store
      .listAccounts()
      .some(
        (account) =>
          account.bookId === bookId &&
          account.kind === kind &&
          account.normalizedName === normalizedName &&
          account.id !== excludeAccountId
      )
  }

  async add(account: LedgerAccount): Promise<void> {
    if (this.store.getAccount(account.id) !== undefined) {
      throw new ApplicationError(
        "DUPLICATE_ENTITY",
        `Ledger account ${account.id} already exists`
      )
    }

    if (account.version !== 0) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        "A new ledger account must start at version zero"
      )
    }

    if (
      account.systemPurpose !== undefined &&
      (await this.findBySystemPurpose(
        account.bookId,
        account.systemPurpose
      )) !== null
    ) {
      throw new ApplicationError(
        "DUPLICATE_ENTITY",
        `System purpose ${account.systemPurpose} already exists in the book`
      )
    }

    this.store.putAccount(account.toSnapshot())
    this.facts?.record(account.pullDomainFacts())
  }

  async save(account: LedgerAccount, expectedVersion: number): Promise<void> {
    const persisted = this.store.getAccount(account.id)
    if (persisted === undefined) {
      throw new ApplicationError(
        "ENTITY_NOT_FOUND",
        `Ledger account ${account.id} was not found`
      )
    }

    if (
      persisted.version !== expectedVersion ||
      account.version !== expectedVersion + 1
    ) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Ledger account ${account.id} has a conflicting version`
      )
    }

    if (persisted.kind !== account.kind) {
      throw new ApplicationError(
        "IMMUTABLE_ACCOUNT_KIND",
        `Ledger account ${account.id} kind cannot be changed`
      )
    }

    this.store.putAccount(account.toSnapshot())
    this.facts?.record(account.pullDomainFacts())
  }
}

export function ledgerAccountSnapshot(
  overrides: Partial<LedgerAccountSnapshot> = {}
): LedgerAccountSnapshot {
  return {
    id: "account-1" as LedgerAccountId,
    bookId: "book-1" as BookId,
    name: "Cash",
    normalizedName: "cash",
    kind: "ASSET",
    status: "ACTIVE",
    version: 0,
    ...overrides,
  }
}
