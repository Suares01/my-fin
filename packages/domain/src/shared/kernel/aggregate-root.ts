import { Entity } from "./entity.js"
import type { DomainFact } from "./domain-fact.js"

export abstract class AggregateRoot<Id, Snapshot> extends Entity<Id> {
  private readonly pendingFacts: DomainFact[] = []

  protected constructor(id: Id) {
    super(id)
  }

  protected recordFact(fact: DomainFact): void {
    this.pendingFacts.push(fact)
  }

  pullDomainFacts(): readonly DomainFact[] {
    return this.pendingFacts.splice(0)
  }

  abstract toSnapshot(): Snapshot
}
