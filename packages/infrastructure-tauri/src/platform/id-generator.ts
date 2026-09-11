import type {
  BookId,
  InvestmentInstrumentId,
  InvestmentOperationId,
  InvestmentPositionId,
  InvestmentValuationId,
  JournalEntryId,
  LedgerAccountId,
  PostingId,
} from "@workspace/domain"
import type { IdGenerator } from "@workspace/application"

export type TauriIdGeneratorOptions = {
  readonly randomUUID?: () => string
}

export class TauriIdGenerator implements IdGenerator {
  private readonly createUuid: () => string

  public constructor(options: TauriIdGeneratorOptions = {}) {
    this.createUuid =
      options.randomUUID ?? (() => globalThis.crypto.randomUUID())
  }

  public nextBookId(): BookId {
    return this.createUuid() as BookId
  }

  public nextLedgerAccountId(): LedgerAccountId {
    return this.createUuid() as LedgerAccountId
  }

  public nextJournalEntryId(): JournalEntryId {
    return this.createUuid() as JournalEntryId
  }

  public nextPostingId(): PostingId {
    return this.createUuid() as PostingId
  }

  public nextInvestmentInstrumentId(): InvestmentInstrumentId {
    return this.createUuid() as InvestmentInstrumentId
  }

  public nextInvestmentPositionId(): InvestmentPositionId {
    return this.createUuid() as InvestmentPositionId
  }

  public nextInvestmentOperationId(): InvestmentOperationId {
    return this.createUuid() as InvestmentOperationId
  }

  public nextInvestmentValuationId(): InvestmentValuationId {
    return this.createUuid() as InvestmentValuationId
  }

  public nextEventId(): string {
    return this.createUuid()
  }
}
