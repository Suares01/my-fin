import type {
  BookId,
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

  public nextEventId(): string {
    return this.createUuid()
  }
}
