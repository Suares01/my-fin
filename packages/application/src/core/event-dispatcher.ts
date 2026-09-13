import { ApplicationError } from "../ports/errors.js"
import type {
  ApplicationEventType,
  DomainEventEnvelope,
  DomainEventPublisher,
} from "../ports/events.js"
import type { Clock, IdGenerator } from "../ports/time.js"
import type { DomainFact } from "@workspace/domain"

const EVENT_TYPES: readonly ApplicationEventType[] = [
  "FinancialBookCreated",
  "LedgerAccountCreated",
  "LedgerAccountArchived",
  "LedgerAccountRenamed",
  "LedgerAccountReactivated",
  "CategoryUpdated",
  "JournalEntryPosted",
  "JournalEntryReversed",
  "JournalEntryAmended",
  "FinancialAccountConfigured",
  "InvestmentSettlementAccountChanged",
  "InvestmentInstrumentCreated",
  "InvestmentInstrumentUpdated",
  "InvestmentInstrumentArchived",
  "InvestmentInstrumentReactivated",
  "InvestmentPositionOpened",
  "InvestmentPositionChanged",
  "InvestmentOperationRecorded",
  "InvestmentOperationReversed",
]

export class DomainEventDispatcher {
  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly publisher: DomainEventPublisher
  ) {}

  async dispatch(facts: readonly DomainFact[]): Promise<void> {
    for (const fact of facts) {
      const type = toEventType(fact.type)
      const payload = fact.payload
      const bookId = getBookId(payload, fact.aggregateId)
      const event: DomainEventEnvelope = {
        eventId: this.ids.nextEventId(),
        type,
        eventVersion: 1,
        occurredAt: this.clock.now(),
        aggregateId: fact.aggregateId,
        aggregateVersion: fact.aggregateVersion,
        bookId,
        payload: toSerializable(payload),
      }
      await this.publisher.publish(event)
    }
  }
}

function toSerializable(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable)
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toSerializable(item)])
    )
  }

  return value
}

function toEventType(type: string): ApplicationEventType {
  if (EVENT_TYPES.includes(type as ApplicationEventType)) {
    return type as ApplicationEventType
  }

  throw new ApplicationError(
    "UNEXPECTED_ERROR",
    `Unsupported domain event type: ${type}`
  )
}

function getBookId(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "bookId" in payload &&
    typeof payload.bookId === "string"
  ) {
    return payload.bookId
  }

  return fallback
}
