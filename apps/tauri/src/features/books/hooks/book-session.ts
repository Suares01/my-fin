import { FinancialBookSummary } from "@workspace/application"
import type {
  ActiveBookSession,
  ActiveBookTransition,
} from "../../../providers/active-book-model.js"

export function resolveBookSession(
  session: ActiveBookSession,
  books: readonly FinancialBookSummary[]
): ActiveBookTransition | null {
  if (session.status === "ACTIVE") {
    return books.some((book) => book.id === session.bookId)
      ? null
      : { type: "CLEAR" }
  }
  if (books.length === 0) return { type: "REQUIRE_CREATION" }
  if (books.length === 1) return { type: "ACTIVATE", bookId: books[0]!.id }
  return { type: "REQUIRE_SELECTION", books }
}

export function isEntityNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENTITY_NOT_FOUND"
  )
}

export function bookErrorMessage(error: unknown): string {
  if (isEntityNotFound(error)) return "Este livro não está mais disponível."
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "DUPLICATE_ENTITY"
  ) {
    return "Já existe um livro com esses dados."
  }
  return "Não foi possível concluir a operação. Tente novamente."
}
