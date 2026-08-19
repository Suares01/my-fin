import type {
  DomainEventEnvelope,
  DomainEventPublisher,
} from "@workspace/application"

export class CollectingDomainEventPublisher implements DomainEventPublisher {
  readonly events: DomainEventEnvelope[] = []

  publish(event: DomainEventEnvelope): void {
    this.events.push(event)
  }

  clear(): void {
    this.events.length = 0
  }
}
