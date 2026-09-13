import type { DomainFact } from "@workspace/domain"

export type ApplicationEventType =
  | "FinancialBookCreated"
  | "LedgerAccountCreated"
  | "LedgerAccountArchived"
  | "LedgerAccountRenamed"
  | "LedgerAccountReactivated"
  | "CategoryUpdated"
  | "JournalEntryPosted"
  | "JournalEntryReversed"
  | "JournalEntryAmended"
  | "FinancialAccountConfigured"
  | "InvestmentSettlementAccountChanged"
  | "InvestmentInstrumentCreated"
  | "InvestmentInstrumentUpdated"
  | "InvestmentInstrumentArchived"
  | "InvestmentInstrumentReactivated"
  | "InvestmentPositionOpened"
  | "InvestmentPositionChanged"
  | "InvestmentOperationRecorded"
  | "InvestmentOperationReversed"

export interface DomainEventEnvelope {
  readonly eventId: string
  readonly type: ApplicationEventType
  readonly eventVersion: 1
  readonly occurredAt: string
  readonly aggregateId: string
  readonly aggregateVersion: number
  readonly bookId: string
  readonly payload: unknown
}

export interface DomainEventPublisher {
  publish(event: DomainEventEnvelope): Promise<void> | void
}

export type PublishableDomainFact = DomainFact<ApplicationEventType, unknown>
