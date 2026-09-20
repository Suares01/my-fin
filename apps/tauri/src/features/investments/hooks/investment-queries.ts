import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query"
import type {
  InvestmentOperationHistoryItem,
  InvestmentPositionView,
  InvestmentValuationHistoryItem,
  QueryPage,
} from "@workspace/application"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useBookDetail } from "../../books/hooks/use-book-detail.js"
import { useActiveBook, useMyFin } from "../../../providers/index.js"
import {
  investmentKeys,
  normalizeInvestmentPositionFilters,
  type InvestmentPositionFilters,
} from "./investment-keys.js"

const INVESTMENT_PAGE_SIZE = 25

type InvestmentPage<T> = InfiniteData<QueryPage<T>, string | undefined> & {
  readonly items: readonly T[]
  readonly nextCursor: string | null
}

function dayInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

function millisecondsUntilNextDay(timezone: string, now = new Date()): number {
  const currentDay = dayInTimezone(timezone, now)
  let delay = 60_000 - (now.getTime() % 60_000)
  while (dayInTimezone(timezone, new Date(now.getTime() + delay)) === currentDay)
    delay += 60_000
  return delay
}

function useBookReferenceDate(timezone: string | undefined): string | undefined {
  const [referenceDate, setReferenceDate] = useState(() =>
    timezone === undefined ? undefined : dayInTimezone(timezone)
  )

  useEffect(() => {
    if (timezone === undefined) return
    const refresh = () => setReferenceDate(dayInTimezone(timezone))
    refresh()
    const timer = window.setTimeout(function scheduleNextDay() {
      refresh()
      window.setTimeout(scheduleNextDay, millisecondsUntilNextDay(timezone))
    }, millisecondsUntilNextDay(timezone))
    return () => window.clearTimeout(timer)
  }, [timezone])

  return referenceDate
}

function resultValue<T>(result: { readonly ok: true; readonly value: T } | {
  readonly ok: false
  readonly error: unknown
}): T {
  if (!result.ok) throw result.error
  return result.value
}

function flattenPages<T>(data: InfiniteData<QueryPage<T>, string | undefined>): InvestmentPage<T> {
  return {
    ...data,
    items: data.pages.flatMap((page) => page.items),
    nextCursor: data.pages.at(-1)?.nextCursor ?? null,
  }
}

function useInvestmentScope() {
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const book = useBookDetail(bookId ?? undefined)
  const referenceDate = useBookReferenceDate(book.data?.timezone)
  return { bookId, referenceDate }
}

export function useInvestmentPortfolio() {
  const services = useMyFin()
  const { bookId, referenceDate } = useInvestmentScope()
  return useQuery({
    queryKey: investmentKeys.portfolio(
      bookId ?? "unresolved",
      referenceDate ?? "unresolved"
    ),
    enabled: bookId !== null && referenceDate !== undefined,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (bookId === null) throw new Error("Investment portfolio requires an active book")
      return resultValue(await services.investments.portfolio.summary.execute({ bookId }))
    },
  })
}

export function useInvestmentAccounts() {
  const services = useMyFin()
  const { bookId, referenceDate } = useInvestmentScope()
  return useQuery({
    queryKey: investmentKeys.accounts(
      bookId ?? "unresolved",
      referenceDate ?? "unresolved"
    ),
    enabled: bookId !== null && referenceDate !== undefined,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (bookId === null) throw new Error("Investment accounts require an active book")
      return resultValue(await services.investments.accounts.list.execute({ bookId }))
    },
  })
}

export function useInvestmentInstruments(status?: "ACTIVE" | "ARCHIVED") {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  return useQuery({
    queryKey: investmentKeys.instruments(bookId ?? "unresolved", status),
    enabled: bookId !== null,
    retry: false,
    queryFn: async () => {
      if (bookId === null) throw new Error("Investment instruments require an active book")
      return resultValue(
        await services.investments.instruments.list.execute({
          bookId,
          ...(status === undefined ? {} : { status }),
        })
      )
    },
  })
}

export function useInvestmentPositions(filters: InvestmentPositionFilters = {}) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const deferredSearch = useDeferredValue(filters.search)
  const normalizedFilters = useMemo(
    () => normalizeInvestmentPositionFilters({ ...filters, search: deferredSearch }),
    [deferredSearch, filters.accountId, filters.assetClass, filters.status]
  )
  return useInfiniteQuery({
    queryKey: investmentKeys.positions(bookId ?? "unresolved", normalizedFilters),
    enabled: bookId !== null,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (bookId === null) throw new Error("Investment positions require an active book")
      return resultValue(
        await services.investments.positions.list.execute({
          bookId,
          ...normalizedFilters,
          limit: INVESTMENT_PAGE_SIZE,
          ...(pageParam === undefined ? {} : { cursor: pageParam }),
        })
      )
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: flattenPages<InvestmentPositionView>,
  })
}

function useInvestmentHistory<T>(input: {
  readonly positionId: string | undefined
  readonly resource: "operations" | "valuations"
  readonly execute: (bookId: string, positionId: string, cursor?: string) => Promise<{
    readonly ok: true
    readonly value: QueryPage<T>
  } | {
    readonly ok: false
    readonly error: unknown
  }>
}) {
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const key = input.resource === "operations"
    ? investmentKeys.operations(bookId ?? "unresolved", input.positionId ?? "unresolved")
    : investmentKeys.valuations(bookId ?? "unresolved", input.positionId ?? "unresolved")
  return useInfiniteQuery({
    queryKey: key,
    enabled: bookId !== null && input.positionId !== undefined,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (bookId === null || input.positionId === undefined)
        throw new Error("Investment history requires an active book and position")
      return resultValue(await input.execute(bookId, input.positionId, pageParam))
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: flattenPages<T>,
  })
}

export function useInvestmentOperations(positionId: string | undefined) {
  const services = useMyFin()
  return useInvestmentHistory<InvestmentOperationHistoryItem>({
    positionId,
    resource: "operations",
    execute: (bookId, scopedPositionId, cursor) =>
      services.investments.operations.list.execute({
        bookId,
        positionId: scopedPositionId,
        limit: INVESTMENT_PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor }),
      }),
  })
}

export function useInvestmentValuations(positionId: string | undefined) {
  const services = useMyFin()
  return useInvestmentHistory<InvestmentValuationHistoryItem>({
    positionId,
    resource: "valuations",
    execute: (bookId, scopedPositionId, cursor) =>
      services.investments.valuations.list.execute({
        bookId,
        positionId: scopedPositionId,
        limit: INVESTMENT_PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor }),
      }),
  })
}

export function invalidateInvestmentQueries(
  queryClient: QueryClient,
  bookId: string
): Promise<unknown> {
  return queryClient.invalidateQueries({
    queryKey: investmentKeys.all(bookId),
    exact: false,
  })
}

export function useInvalidateInvestmentQueries() {
  const queryClient = useQueryClient()
  return (bookId: string) => invalidateInvestmentQueries(queryClient, bookId)
}
