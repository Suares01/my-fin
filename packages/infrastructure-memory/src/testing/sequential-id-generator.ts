import type { IdGenerator } from "@workspace/application"
import type {
  BookId,
  JournalEntryId,
  LedgerAccountId,
  PostingId,
} from "@workspace/domain"

export class SequentialIdGenerator implements IdGenerator {
  private readonly counters = new Map<string, number>()

  nextBookId(): BookId {
    return this.next("book") as BookId
  }

  nextLedgerAccountId(): LedgerAccountId {
    return this.next("account") as LedgerAccountId
  }

  nextJournalEntryId(): JournalEntryId {
    return this.next("entry") as JournalEntryId
  }

  nextPostingId(): PostingId {
    return this.next("posting") as PostingId
  }

  nextEventId(): string {
    return this.next("event")
  }

  private next(kind: string): string {
    const nextValue = (this.counters.get(kind) ?? 0) + 1
    this.counters.set(kind, nextValue)
    return `${kind}-${nextValue}`
  }
}
