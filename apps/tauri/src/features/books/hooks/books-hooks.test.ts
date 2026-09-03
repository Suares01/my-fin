import { describe, expect, it, vi } from "vitest"

import { createMyFinQueryClient } from "../../../providers/query-client.js"
import {
  bookErrorMessage,
  bookKeys,
  isEntityNotFound,
  resolveBookSession,
} from "./index.js"
import { ApplicationError, FinancialBookSummary } from "@workspace/application"

const books: readonly FinancialBookSummary[] = [
  {
    id: "book-1",
    name: "Casa",
    baseCurrency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  { id: "book-2", name: "Trabalho", baseCurrency: "BRL", timezone: "UTC" },
]

describe("book session hook contracts", () => {
  it("requires creation for an empty catalog", () => {
    expect(resolveBookSession({ status: "UNRESOLVED" }, [])).toEqual({
      type: "REQUIRE_CREATION",
    })
  })

  it("auto-activates exactly one book", () => {
    expect(resolveBookSession({ status: "UNRESOLVED" }, [books[0]!])).toEqual({
      type: "ACTIVATE",
      bookId: "book-1",
    })
  })

  it("requires explicit selection for many books", () => {
    expect(resolveBookSession({ status: "UNRESOLVED" }, books)).toEqual({
      type: "REQUIRE_SELECTION",
      books,
    })
  })

  it("does not auto-select from a stale multiple-book result", () => {
    const result = resolveBookSession(
      { status: "REQUIRES_SELECTION", books },
      books
    )
    expect(result).toEqual({ type: "REQUIRE_SELECTION", books })
  })

  it("keeps an active book when the catalog still contains it", () => {
    expect(
      resolveBookSession({ status: "ACTIVE", bookId: "book-1" }, books)
    ).toBeNull()
  })

  it("clears a missing active book without selecting another book", () => {
    expect(
      resolveBookSession({ status: "ACTIVE", bookId: "missing" }, books)
    ).toEqual({
      type: "CLEAR",
    })
  })

  it("keeps an existing creation gate from creating a second transition", () => {
    const result = resolveBookSession({ status: "REQUIRES_CREATION" }, [])
    expect(result).toEqual({ type: "REQUIRE_CREATION" })
  })

  it("keeps an existing selection gate scoped to the returned summaries", () => {
    const result = resolveBookSession(
      { status: "REQUIRES_SELECTION", books },
      books
    )
    expect(result?.type).toBe("REQUIRE_SELECTION")
    if (result?.type === "REQUIRE_SELECTION")
      expect(result.books[1]?.id).toBe("book-2")
  })
})

describe("book query and mutation contracts", () => {
  it("uses one global catalog key", () => {
    expect(bookKeys.all).toEqual(["books"])
  })

  it("configures query clients with retry false for create commands", () => {
    const client = createMyFinQueryClient()
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })

  it("recognizes an entity-not-found result as a scoped-session failure", () => {
    expect(
      isEntityNotFound(new ApplicationError("ENTITY_NOT_FOUND", "hidden"))
    ).toBe(true)
    expect(
      isEntityNotFound(new ApplicationError("UNEXPECTED_ERROR", "hidden"))
    ).toBe(false)
  })

  it("maps known errors to safe Portuguese copy", () => {
    expect(
      bookErrorMessage(new ApplicationError("ENTITY_NOT_FOUND", "secret"))
    ).toBe("Este livro não está mais disponível.")
    expect(
      bookErrorMessage(new ApplicationError("DUPLICATE_ENTITY", "secret"))
    ).toBe("Já existe um livro com esses dados.")
  })

  it("does not expose internal error messages in the fallback", () => {
    const error = new ApplicationError(
      "UNEXPECTED_ERROR",
      "SQL /tmp/vault.sqlite"
    )
    expect(bookErrorMessage(error)).toBe(
      "Não foi possível concluir a operação. Tente novamente."
    )
    expect(bookErrorMessage(error)).not.toContain("vault.sqlite")
  })

  it("keeps query data as readonly catalog summaries", () => {
    const list = vi.fn().mockResolvedValue({ ok: true, value: books })
    expect(list).toHaveBeenCalledTimes(0)
    expect(books[0]).toMatchObject({
      id: "book-1",
      name: "Casa",
      baseCurrency: "BRL",
    })
  })
})
