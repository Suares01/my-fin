import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ActiveBookProvider,
  clearBookScopedQueries,
  createMyFinQueryClient,
  MyFinProvider,
  MyFinProviders,
  MyFinQueryProvider,
  useActiveBook,
  useMyFin,
  transitionActiveBookSession,
  type ActiveBookSession,
} from "./index.js"

const services = {} as never

describe("MyFin providers", () => {
  it("fails clearly when useMyFin is outside its provider", () => {
    expect(() => renderToStaticMarkup(<MissingServices />)).toThrow(
      "useMyFin must be used within MyFinProvider"
    )
  })

  it("exposes the same services instance through MyFinProvider", () => {
    expect(
      renderToStaticMarkup(
        <MyFinProvider services={services}>
          <ServicesProbe />
        </MyFinProvider>
      )
    ).toContain("services-present")
  })

  it("fails clearly when useActiveBook is outside its provider", () => {
    expect(() => renderToStaticMarkup(<MissingActiveBook />)).toThrow(
      "useActiveBook must be used within ActiveBookProvider"
    )
  })

  it.each([
    [{ status: "UNRESOLVED" }, "UNRESOLVED"],
    [{ status: "REQUIRES_CREATION" }, "REQUIRES_CREATION"],
    [{ status: "REQUIRES_SELECTION", books: [] }, "REQUIRES_SELECTION"],
    [{ status: "ACTIVE", bookId: "book-1" }, "ACTIVE:book-1"],
  ] as const)("renders the session state %s", (initial, expected) => {
    const session = initial as ActiveBookSession
    expect(
      renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <ActiveBookProvider initial={session}>
            <SessionProbe />
          </ActiveBookProvider>
        </QueryClientProvider>
      )
    ).toContain(expected)
  })

  it("does not expose a runtime object in the active-book context", () => {
    expect(
      renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <ActiveBookProvider>
            <SessionProbe />
          </ActiveBookProvider>
        </QueryClientProvider>
      )
    ).toContain("UNRESOLVED")
  })

  it("transitions from unresolved to creation", () => {
    expect(
      transitionActiveBookSession(
        { status: "UNRESOLVED" },
        { type: "REQUIRE_CREATION" }
      )
    ).toEqual({ status: "REQUIRES_CREATION" })
  })

  it("transitions from creation to selection with catalog summaries", () => {
    const books = [
      { id: "book-1", name: "Casa", baseCurrency: "BRL", timezone: "UTC" },
    ] as const
    expect(
      transitionActiveBookSession(
        { status: "REQUIRES_CREATION" },
        { type: "REQUIRE_SELECTION", books }
      )
    ).toEqual({ status: "REQUIRES_SELECTION", books })
  })

  it("transitions selection to one active book id", () => {
    expect(
      transitionActiveBookSession(
        { status: "REQUIRES_SELECTION", books: [] },
        { type: "ACTIVATE", bookId: "book-1" }
      )
    ).toEqual({ status: "ACTIVE", bookId: "book-1" })
  })

  it("clears an active session without retaining book data", () => {
    expect(
      transitionActiveBookSession(
        { status: "ACTIVE", bookId: "book-1" },
        { type: "CLEAR" }
      )
    ).toEqual({ status: "UNRESOLVED" })
  })

  it("configures previous data retention for queries", () => {
    const client = createMyFinQueryClient()
    expect(client.getDefaultOptions().queries?.placeholderData).toBeTypeOf(
      "function"
    )
  })

  it("disables mutation retries globally", () => {
    const client = createMyFinQueryClient()
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })

  it("uses one explicit query client when the provider is composed", () => {
    const client = createMyFinQueryClient()
    expect(
      renderToStaticMarkup(
        <MyFinQueryProvider client={client}>
          <QueryProbe />
        </MyFinQueryProvider>
      )
    ).toContain("query-client-present")
  })

  it("removes only the selected book query namespace", () => {
    const client = createMyFinQueryClient()
    client.setQueryData(["books", "book-1", "account-balances"], [1])
    client.setQueryData(["books", "book-2", "account-balances"], [2])
    client.setQueryData(["books"], ["catalog"])

    clearBookScopedQueries(client, "book-1")

    expect(client.getQueryData(["books", "book-1", "account-balances"])).toBe(
      undefined
    )
    expect(
      client.getQueryData(["books", "book-2", "account-balances"])
    ).toEqual([2])
    expect(client.getQueryData(["books"])).toEqual(["catalog"])
  })

  it("composes services, query cache, and active-book session", () => {
    expect(renderToStaticMarkup(<MyFinProvidersProbe />)).toContain(
      "UNRESOLVED|services-present|query-client-present"
    )
  })
})

function MissingServices() {
  useMyFin()
  return null
}

function ServicesProbe() {
  return <span>{useMyFin() === services ? "services-present" : "wrong"}</span>
}

function MissingActiveBook() {
  useActiveBook()
  return null
}

function SessionProbe() {
  const { session } = useActiveBook()
  return (
    <span>
      {session.status}
      {session.status === "ACTIVE" ? `:${session.bookId}` : ""}
    </span>
  )
}

function QueryProbe() {
  return <span>{useQueryClient() ? "query-client-present" : "missing"}</span>
}

function MyFinProvidersProbe() {
  return (
    <MyFinProviders services={services}>
      <CombinedProbe />
    </MyFinProviders>
  )
}

function CombinedProbe() {
  const { session } = useActiveBook()
  const queryClient = useQueryClient()
  return (
    <span>
      {session.status}|{useMyFin() === services ? "services-present" : "wrong"}|
      {queryClient ? "query-client-present" : "missing"}
    </span>
  )
}
