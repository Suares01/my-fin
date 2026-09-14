import type { InvestmentValuationStore } from "@workspace/application"
import type { InvestmentValuationSnapshot } from "@workspace/domain"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { mapSqliteError } from "../database/sqlite-error.js"

export class SqliteInvestmentValuationStore implements InvestmentValuationStore {
  public constructor(private readonly executor: SqliteExecutor) {}

  public async append(value: InvestmentValuationSnapshot): Promise<void> {
    try {
      await this.executor.execute(
        "INSERT INTO investment_valuations (id, book_id, position_id, allocation_revision, valued_at, valued_on, recorded_at, record_sequence, source, quantity, unit_price, currency, gross_value_minor, net_value_minor, withdrawable_value_minor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          value.id,
          value.bookId,
          value.positionId,
          value.allocationRevision,
          value.valuedAt,
          value.valuedOn,
          value.recordedAt,
          value.recordSequence,
          value.source,
          value.quantity ?? null,
          value.unitPrice ?? null,
          value.currency,
          value.grossValueMinor,
          value.netValueMinor ?? null,
          value.withdrawableValueMinor ?? null,
        ]
      )
    } catch (error) {
      throw mapSqliteError(error)
    }
  }
}
