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
  type SystemAccountPurpose,
} from "@workspace/domain"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { mapSqliteError } from "../database/sqlite-error.js"
import {
  LedgerAccountMapper,
  type LedgerAccountRow,
} from "../mappers/ledger-account-mapper.js"

export class SqliteLedgerAccountRepository implements LedgerAccountRepository {
  public constructor(
    private readonly executor: SqliteExecutor,
    private readonly facts?: DomainFactCollector
  ) {}

  public async findById(id: LedgerAccountId): Promise<LedgerAccount | null> {
    const rows = await this.executor.query<LedgerAccountRow>(
      ACCOUNT_SELECT + " WHERE accounts.id = ?",
      [id]
    )
    const row = rows[0]
    return row === undefined ? null : LedgerAccountMapper.toDomain(row)
  }

  public async findBySystemPurpose(
    bookId: BookId,
    purpose: SystemAccountPurpose
  ): Promise<LedgerAccount | null> {
    const rows = await this.executor.query<LedgerAccountRow>(
      ACCOUNT_SELECT +
        " WHERE accounts.book_id = ? AND accounts.system_purpose = ?",
      [bookId, purpose]
    )
    const row = rows[0]
    return row === undefined ? null : LedgerAccountMapper.toDomain(row)
  }

  public async existsWithName(
    bookId: BookId,
    kind: LedgerAccountKind,
    normalizedName: string,
    excludeAccountId?: LedgerAccountId
  ): Promise<boolean> {
    const exclusion = excludeAccountId === undefined ? "" : " AND id <> ?"
    const rows = await this.executor.query<{ readonly present: number }>(
      "SELECT 1 AS present FROM ledger_accounts " +
        "WHERE book_id = ? AND kind = ? AND normalized_name = ?" +
        exclusion +
        " LIMIT 1",
      excludeAccountId === undefined
        ? [bookId, kind, normalizedName]
        : [bookId, kind, normalizedName, excludeAccountId]
    )
    return rows.length > 0
  }

  public async add(account: LedgerAccount): Promise<void> {
    if (account.version !== 0) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        "A new ledger account must start at version zero"
      )
    }

    const values = LedgerAccountMapper.toPersistence(account)
    try {
      await this.executor.execute(
        "INSERT INTO ledger_accounts " +
          "(id, book_id, name, normalized_name, kind, status, " +
          "system_purpose, version, icon_key, color_hex) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          values.id,
          values.book_id,
          values.name,
          values.normalized_name,
          values.kind,
          values.status,
          values.system_purpose,
          values.version,
          values.icon_key,
          values.color_hex,
        ]
      )
      if (account.financialAccount !== undefined) {
        await this.saveFinancialProfile(account)
      }
    } catch (error) {
      throw mapSqliteError(error)
    }

    this.facts?.record(account.pullDomainFacts())
  }

  public async save(
    account: LedgerAccount,
    expectedVersion: number
  ): Promise<void> {
    if (account.version !== expectedVersion + 1) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Ledger account ${account.id} has a conflicting version`
      )
    }

    const values = LedgerAccountMapper.toPersistence(account)
    let result
    try {
      result = await this.executor.execute(
        "UPDATE ledger_accounts SET name = ?, normalized_name = ?, " +
          "status = ?, system_purpose = ?, icon_key = ?, color_hex = ?, " +
          "version = ? " +
          "WHERE id = ? AND version = ? AND kind = ?",
        [
          values.name,
          values.normalized_name,
          values.status,
          values.system_purpose,
          values.icon_key,
          values.color_hex,
          values.version,
          values.id,
          expectedVersion,
          values.kind,
        ]
      )
      if (result.rowsAffected !== 0 && account.financialAccount !== undefined) {
        await this.saveFinancialProfile(account)
      }
    } catch (error) {
      throw mapSqliteError(error)
    }

    if (result.rowsAffected === 0) {
      const persisted = await this.findById(account.id)
      if (persisted === null) {
        throw new ApplicationError(
          "ENTITY_NOT_FOUND",
          `Ledger account ${account.id} was not found`
        )
      }

      if (persisted.kind !== account.kind) {
        throw new ApplicationError(
          "IMMUTABLE_ACCOUNT_KIND",
          `Ledger account ${account.id} kind cannot be changed`
        )
      }

      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Ledger account ${account.id} has a conflicting version`
      )
    }

    this.facts?.record(account.pullDomainFacts())
  }

  private async saveFinancialProfile(account: LedgerAccount): Promise<void> {
    const profile = account.financialAccount
    if (profile === undefined) {
      return
    }
    await this.executor.execute(
      "DELETE FROM investment_accounts WHERE ledger_account_id = ? AND book_id = ?",
      [account.id, account.bookId]
    )

    await this.executor.execute(
      "INSERT INTO financial_accounts (ledger_account_id, book_id, type, institution_name, display_reference) " +
        "VALUES (?, ?, ?, ?, ?) ON CONFLICT(ledger_account_id) DO UPDATE SET " +
        "book_id = excluded.book_id, type = excluded.type, institution_name = excluded.institution_name, " +
        "display_reference = excluded.display_reference",
      [
        account.id,
        account.bookId,
        profile.type === "BANK_ACCOUNT" ? "BANK" : profile.type,
        profile.institutionName ?? null,
        profile.displayReference ?? null,
      ]
    )

    if (profile.type === "INVESTMENT_ACCOUNT") {
      await this.executor.execute(
        "INSERT INTO investment_accounts (ledger_account_id, book_id, default_settlement_account_id) VALUES (?, ?, ?)",
        [
          account.id,
          account.bookId,
          profile.investment?.defaultSettlementAccountId ?? null,
        ]
      )
    }
  }
}

const ACCOUNT_SELECT =
  "SELECT accounts.id, accounts.book_id, accounts.name, accounts.normalized_name, " +
  "accounts.kind, accounts.status, accounts.system_purpose, accounts.version, " +
  "accounts.icon_key, accounts.color_hex, financial.type AS financial_type, " +
  "financial.institution_name, financial.display_reference, " +
  "investment.default_settlement_account_id FROM ledger_accounts AS accounts " +
  "LEFT JOIN financial_accounts AS financial ON financial.ledger_account_id = accounts.id " +
  "AND financial.book_id = accounts.book_id LEFT JOIN investment_accounts AS investment " +
  "ON investment.ledger_account_id = accounts.id AND investment.book_id = accounts.book_id"
