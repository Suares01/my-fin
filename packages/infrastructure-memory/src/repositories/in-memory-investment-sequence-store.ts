import {
  ApplicationError,
  type InvestmentSequenceStore,
} from "@workspace/application"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryInvestmentSequenceStore implements InvestmentSequenceStore {
  constructor(private readonly store: InMemoryStore) {}

  async next(bookId: string): Promise<string> {
    try {
      return this.store.reserveNextInvestmentSequence(bookId as never)
    } catch (error) {
      if (error instanceof RangeError)
        throw new ApplicationError(
          "UNEXPECTED_ERROR",
          "Investment sequence is outside the supported SQLite range"
        )
      throw error
    }
  }
}
