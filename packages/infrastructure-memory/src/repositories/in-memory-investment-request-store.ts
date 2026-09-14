import {
  ApplicationError,
  type InvestmentRequestReceipt,
  type InvestmentRequestStore,
} from "@workspace/application"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryInvestmentRequestStore implements InvestmentRequestStore {
  constructor(private readonly store: InMemoryStore) {}

  async find(
    bookId: string,
    requestId: string
  ): Promise<InvestmentRequestReceipt | null> {
    return this.store.getInvestmentRequest(bookId as never, requestId) ?? null
  }

  async add(receipt: InvestmentRequestReceipt): Promise<void> {
    if (
      this.store.getInvestmentRequest(
        receipt.bookId as never,
        receipt.requestId
      )
    )
      throw new ApplicationError(
        "DUPLICATE_ENTITY",
        "The requested entity already exists"
      )
    this.store.putInvestmentRequest(receipt)
  }
}
