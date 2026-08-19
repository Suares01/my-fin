import { Currency } from "../../shared/identity/currency.js"
import type {
  BookId,
  JournalEntryId,
  PostingId,
} from "../../shared/identity/ids.js"
import { AggregateRoot } from "../../shared/kernel/aggregate-root.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { LocalDate } from "../../shared/local-date.js"
import { Posting } from "./posting.js"
import type { PostingSnapshot } from "./posting.js"

export type JournalEntryOrigin = "MANUAL" | "SYSTEM"

export interface JournalEntrySnapshot {
  readonly id: JournalEntryId
  readonly bookId: BookId
  readonly occurredOn: string
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly currency: string
  readonly origin: JournalEntryOrigin
  readonly postings: readonly PostingSnapshot[]
  readonly reversalOf?: JournalEntryId
  readonly reversedBy?: JournalEntryId
  readonly replacementOf?: JournalEntryId
  readonly replacedBy?: JournalEntryId
  readonly version: number
}

export interface PostJournalEntryInput {
  readonly id: JournalEntryId
  readonly bookId: BookId
  readonly occurredOn: LocalDate
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly currency: Currency
  readonly origin: JournalEntryOrigin
  readonly postings: readonly Posting[]
  readonly replacementOf?: JournalEntryId
}

export interface CreateJournalEntryReversalInput {
  readonly id: JournalEntryId
  readonly occurredOn: LocalDate
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly postingIds: readonly PostingId[]
}

export type RestoreJournalEntryInput = JournalEntrySnapshot

export class JournalEntry extends AggregateRoot<
  JournalEntryId,
  JournalEntrySnapshot
> {
  private constructor(
    id: JournalEntryId,
    private readonly entryBookId: BookId,
    private readonly entryOccurredOn: LocalDate,
    private readonly entryRecordedAt: string,
    private readonly entrySequence: string,
    private readonly entryDescription: string,
    private readonly entryCurrency: Currency,
    private readonly entryOrigin: JournalEntryOrigin,
    private readonly entryPostings: readonly Posting[],
    private readonly entryReversalOf: JournalEntryId | undefined,
    private entryReversedBy: JournalEntryId | undefined,
    private readonly entryReplacementOf: JournalEntryId | undefined,
    private entryReplacedBy: JournalEntryId | undefined,
    private entryVersion: number
  ) {
    super(id)
  }

  static post(input: PostJournalEntryInput): JournalEntry {
    const description = input.description.trim()
    if (description.length === 0) {
      throw new DomainError(
        "INVALID_JOURNAL_DESCRIPTION",
        "Journal entry description cannot be empty"
      )
    }

    validateOrderMetadata(input.recordedAt, input.sequence)
    validatePostings(input.postings, input.currency)
    validateLineageLinks(
      input.id,
      input.replacementOf,
      undefined,
      undefined,
      undefined
    )
    const entry = new JournalEntry(
      input.id,
      input.bookId,
      input.occurredOn,
      input.recordedAt,
      input.sequence,
      description,
      input.currency,
      input.origin,
      input.postings.slice(),
      undefined,
      undefined,
      input.replacementOf,
      undefined,
      0
    )
    entry.recordFact({
      type: "JournalEntryPosted",
      aggregateId: input.id,
      aggregateVersion: entry.version,
      payload: entry.toSnapshot(),
    })
    return entry
  }

  static restore(snapshot: RestoreJournalEntryInput): JournalEntry {
    const currency = Currency.parse(snapshot.currency)
    const postings = snapshot.postings.map((posting) =>
      Posting.restore(posting)
    )
    validatePostings(postings, currency)
    validateLineageLinks(
      snapshot.id,
      snapshot.replacementOf,
      snapshot.reversalOf,
      snapshot.reversedBy,
      snapshot.replacedBy
    )

    return new JournalEntry(
      snapshot.id,
      snapshot.bookId,
      LocalDate.parse(snapshot.occurredOn),
      validateRecordedAt(snapshot.recordedAt),
      validateSequence(snapshot.sequence),
      snapshot.description,
      currency,
      snapshot.origin,
      postings,
      snapshot.reversalOf,
      snapshot.reversedBy,
      snapshot.replacementOf,
      snapshot.replacedBy,
      snapshot.version
    )
  }

  get bookId(): BookId {
    return this.entryBookId
  }

  get occurredOn(): LocalDate {
    return this.entryOccurredOn
  }

  get recordedAt(): string {
    return this.entryRecordedAt
  }

  get sequence(): string {
    return this.entrySequence
  }

  get description(): string {
    return this.entryDescription
  }

  get currency(): Currency {
    return this.entryCurrency
  }

  get origin(): JournalEntryOrigin {
    return this.entryOrigin
  }

  get postings(): readonly Posting[] {
    return this.entryPostings.slice()
  }

  get reversalOf(): JournalEntryId | undefined {
    return this.entryReversalOf
  }

  get reversedBy(): JournalEntryId | undefined {
    return this.entryReversedBy
  }

  get replacementOf(): JournalEntryId | undefined {
    return this.entryReplacementOf
  }

  get replacedBy(): JournalEntryId | undefined {
    return this.entryReplacedBy
  }

  get version(): number {
    return this.entryVersion
  }

  isEffective(): boolean {
    return (
      this.reversalOf === undefined &&
      this.reversedBy === undefined &&
      this.replacedBy === undefined
    )
  }

  createReversal(input: CreateJournalEntryReversalInput): JournalEntry {
    if (this.reversalOf !== undefined) {
      throw new DomainError(
        "JOURNAL_ENTRY_REVERSAL_NOT_REVERSIBLE",
        "A journal entry reversal cannot be reversed"
      )
    }

    if (this.reversedBy !== undefined) {
      throw new DomainError(
        "JOURNAL_ENTRY_ALREADY_REVERSED",
        "Journal entry has already been reversed"
      )
    }

    if (input.occurredOn.value < this.occurredOn.value) {
      throw new DomainError(
        "REVERSAL_DATE_BEFORE_ORIGINAL",
        "A reversal cannot occur before the original journal entry"
      )
    }

    validateOrderMetadata(input.recordedAt, input.sequence)

    if (input.id === this.id) {
      throw new DomainError(
        "INVALID_REVERSAL_ID",
        "A reversal must use an ID different from the original journal entry"
      )
    }

    if (input.postingIds.length !== this.postings.length) {
      throw new DomainError(
        "INVALID_REVERSAL_POSTINGS",
        "A reversal requires one posting id for each original posting"
      )
    }

    if (new Set(input.postingIds).size !== input.postingIds.length) {
      throw new DomainError(
        "DUPLICATE_POSTING_ID",
        "A journal entry cannot contain duplicate posting IDs"
      )
    }

    const reversedPostings = this.postings.map((posting, index) => {
      const postingId = input.postingIds[index]
      if (postingId === undefined) {
        throw new DomainError(
          "INVALID_REVERSAL_POSTINGS",
          "A reversal requires one posting id for each original posting"
        )
      }

      return posting.reverse(postingId)
    })
    const description = input.description.trim()
    if (description.length === 0) {
      throw new DomainError(
        "INVALID_JOURNAL_DESCRIPTION",
        "Journal entry description cannot be empty"
      )
    }

    const reversal = new JournalEntry(
      input.id,
      this.bookId,
      input.occurredOn,
      input.recordedAt,
      input.sequence,
      description,
      this.currency,
      "SYSTEM",
      reversedPostings,
      this.id,
      undefined,
      undefined,
      undefined,
      0
    )
    reversal.recordFact({
      type: "JournalEntryPosted",
      aggregateId: reversal.id,
      aggregateVersion: reversal.version,
      payload: reversal.toSnapshot(),
    })
    return reversal
  }

  markReversedBy(id: JournalEntryId): void {
    if (this.reversalOf !== undefined) {
      throw new DomainError(
        "JOURNAL_ENTRY_REVERSAL_NOT_REVERSIBLE",
        "A journal entry reversal cannot be reversed"
      )
    }

    if (this.reversedBy !== undefined) {
      throw new DomainError(
        "JOURNAL_ENTRY_ALREADY_REVERSED",
        "Journal entry has already been reversed"
      )
    }

    if (this.replacedBy !== undefined) {
      throw new DomainError(
        "JOURNAL_ENTRY_NOT_EFFECTIVE",
        "Only an effective business entry can change"
      )
    }

    if (id === this.id) {
      throw new DomainError(
        "INVALID_REVERSAL_ID",
        "A journal entry cannot be reversed by itself"
      )
    }

    if (this.reversedBy !== undefined) {
      throw new DomainError(
        "JOURNAL_ENTRY_ALREADY_REVERSED",
        "Journal entry has already been reversed"
      )
    }

    this.entryReversedBy = id
    this.entryVersion += 1
    this.recordFact({
      type: "JournalEntryReversed",
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: {
        bookId: this.bookId,
        originalId: this.id,
        reversalId: id,
      },
    })
  }

  markAmendedBy(
    reversalId: JournalEntryId,
    replacementId: JournalEntryId
  ): void {
    this.assertEffective("JOURNAL_ENTRY_NOT_EFFECTIVE")

    if (
      reversalId === this.id ||
      replacementId === this.id ||
      reversalId === replacementId
    ) {
      throw new DomainError(
        "INVALID_REPLACEMENT_ID",
        "An amendment must use distinct IDs for its target and new entries"
      )
    }

    this.entryReversedBy = reversalId
    this.entryReplacedBy = replacementId
    this.entryVersion += 1
    this.recordFact({
      type: "JournalEntryAmended",
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: {
        bookId: this.bookId,
        originalId: this.id,
        reversalId,
        replacementId,
      },
    })
  }

  private assertEffective(code: "JOURNAL_ENTRY_NOT_EFFECTIVE"): void {
    if (this.isEffective()) {
      return
    }

    throw new DomainError(code, "Only an effective business entry can change")
  }

  toSnapshot(): JournalEntrySnapshot {
    return {
      id: this.id,
      bookId: this.bookId,
      occurredOn: this.occurredOn.value,
      recordedAt: this.recordedAt,
      sequence: this.sequence,
      description: this.description,
      currency: this.currency.code,
      origin: this.origin,
      postings: this.postings.map((posting) => posting.toSnapshot()),
      ...(this.reversalOf === undefined ? {} : { reversalOf: this.reversalOf }),
      ...(this.reversedBy === undefined ? {} : { reversedBy: this.reversedBy }),
      ...(this.replacementOf === undefined
        ? {}
        : { replacementOf: this.replacementOf }),
      ...(this.replacedBy === undefined ? {} : { replacedBy: this.replacedBy }),
      version: this.version,
    }
  }
}

function validateOrderMetadata(recordedAt: string, sequence: string): void {
  validateRecordedAt(recordedAt)
  validateSequence(sequence)
}

function validateRecordedAt(recordedAt: string): string {
  if (
    typeof recordedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      recordedAt
    ) ||
    Number.isNaN(Date.parse(recordedAt))
  ) {
    throw new DomainError(
      "INVALID_RECORDED_AT",
      "Journal entry recordedAt must be a valid ISO 8601 instant"
    )
  }

  return recordedAt
}

function validateSequence(sequence: string): string {
  if (typeof sequence !== "string" || !/^(0|[1-9]\d*)$/.test(sequence)) {
    throw new DomainError(
      "INVALID_JOURNAL_SEQUENCE",
      "Journal entry sequence must be a non-negative decimal string"
    )
  }

  return sequence
}

function validatePostings(
  postings: readonly Posting[],
  currency: Currency
): void {
  if (postings.length < 2) {
    throw new DomainError(
      "INSUFFICIENT_POSTINGS",
      "A journal entry requires at least two postings"
    )
  }

  if (new Set(postings.map((posting) => posting.accountId)).size < 2) {
    throw new DomainError(
      "INSUFFICIENT_ACCOUNTS",
      "A journal entry requires at least two distinct accounts"
    )
  }

  if (new Set(postings.map((posting) => posting.id)).size !== postings.length) {
    throw new DomainError(
      "DUPLICATE_POSTING_ID",
      "A journal entry cannot contain duplicate posting IDs"
    )
  }

  let total = 0n
  for (const posting of postings) {
    if (posting.amount.amountMinor === 0n) {
      throw new DomainError(
        "ZERO_POSTING_AMOUNT",
        "Posting amount cannot be zero"
      )
    }

    if (!posting.amount.currency.equals(currency)) {
      throw new DomainError(
        "CURRENCY_MISMATCH",
        "Journal entry postings must use the entry currency"
      )
    }

    total += posting.amount.amountMinor
  }

  if (total !== 0n) {
    throw new DomainError(
      "UNBALANCED_JOURNAL_ENTRY",
      "Journal entry postings must sum to zero"
    )
  }
}

function validateLineageLinks(
  id: JournalEntryId,
  replacementOf: JournalEntryId | undefined,
  reversalOf: JournalEntryId | undefined,
  reversedBy: JournalEntryId | undefined,
  replacedBy: JournalEntryId | undefined
): void {
  if (
    replacementOf === id ||
    reversalOf === id ||
    reversedBy === id ||
    replacedBy === id ||
    (reversalOf !== undefined &&
      (replacementOf !== undefined || replacedBy !== undefined)) ||
    false
  ) {
    throw new DomainError(
      "INVALID_REVERSAL_ID",
      "A journal entry cannot contain invalid lineage links"
    )
  }
}
