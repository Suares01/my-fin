import type { InvestmentValuationStore } from "@workspace/application"
import type { InvestmentValuationSnapshot } from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryInvestmentValuationStore implements InvestmentValuationStore {
  constructor(private readonly store: InMemoryStore) {}

  async append(value: InvestmentValuationSnapshot): Promise<void> {
    this.store.putInvestmentValuation(value)
  }
}
