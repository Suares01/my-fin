import {
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateExpenseCategory,
  CreateIncomeCategory,
  DomainEventDispatcher,
} from "@workspace/application"
import {
  CollectingDomainEventPublisher,
  FixedClock,
  InMemoryStore,
  InMemoryTransactionManager,
  SequentialIdGenerator,
} from "../index.js"

export function createHarness() {
  const store = new InMemoryStore()
  const ids = new SequentialIdGenerator()
  const publisher = new CollectingDomainEventPublisher()
  const transactionManager = new InMemoryTransactionManager(store)
  const clock = new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04")
  const dispatcher = new DomainEventDispatcher(clock, ids, publisher)

  return { store, ids, publisher, transactionManager, dispatcher, clock }
}

export const validBookCommand = {
  name: "Personal book",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
} as const

export async function createBook(harness: ReturnType<typeof createHarness>) {
  const result = await new CreateFinancialBook(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  ).execute(validBookCommand)
  if (!result.ok) {
    throw new Error(`Book fixture failed: ${result.error.code}`)
  }
  harness.publisher.clear()
  return result.value
}

export async function createFinancialAccount(
  harness: ReturnType<typeof createHarness>,
  kind: "ASSET" | "LIABILITY" = "ASSET"
) {
  const result = await new CreateFinancialAccount(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  ).execute({
    bookId: "book-1",
    name: kind === "ASSET" ? "Checking" : "Credit card",
    type: kind === "ASSET" ? "OTHER_ASSET" : "OTHER_LIABILITY",
  })
  if (!result.ok) {
    throw new Error(`Account fixture failed: ${result.error.code}`)
  }
  harness.publisher.clear()
  return result.value
}

export async function createExpenseCategory(
  harness: ReturnType<typeof createHarness>
) {
  const result = await new CreateExpenseCategory(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  ).execute({
    bookId: "book-1",
    name: "Food",
    kind: "EXPENSE",
    iconKey: "restaurant",
    colorHex: "f43f5e",
  })
  if (!result.ok) {
    throw new Error(`Expense category fixture failed: ${result.error.code}`)
  }
  harness.publisher.clear()
  return result.value
}

export async function createIncomeCategory(
  harness: ReturnType<typeof createHarness>
) {
  const result = await new CreateIncomeCategory(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  ).execute({
    bookId: "book-1",
    name: "Salary",
    kind: "INCOME",
    iconKey: "briefcase",
    colorHex: "10b981",
  })
  if (!result.ok) {
    throw new Error(`Income category fixture failed: ${result.error.code}`)
  }
  harness.publisher.clear()
  return result.value
}
