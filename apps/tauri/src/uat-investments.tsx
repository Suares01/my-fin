import ReactDOM from "react-dom/client"
import { MemoryRouter, Route, Routes } from "react-router"
import "./styles.css"
import {
  ActiveBookProvider,
  MyFinProvider,
  MyFinQueryProvider,
} from "./providers"
import { InvestmentsPage } from "./features/investments/components/investments-page"
import { ApplicationShell } from "./layout/app-shell"
import type { MyFinServices } from "./bootstrap/create-services"

const account = {
  id: "wallet-1",
  name: "Corretora A",
  currency: "BRL",
  status: "ACTIVE",
  ledgerBalanceMinor: "100000",
  positionCostMinor: "80000",
  cashMinor: "20000",
  marketValueMinor: "85000",
  unrealizedResultMinor: "5000",
}
const instrument = {
  id: "instrument-1",
  instrumentClass: "FIXED_INCOME",
  version: 0,
  name: "CDB A",
  type: "CDB",
  currency: "BRL",
  status: "ACTIVE",
  identifiers: [],
}
const position = {
  id: "position-1",
  investmentAccountId: account.id,
  instrumentId: instrument.id,
  instrumentName: instrument.name,
  assetClass: "FIXED_INCOME",
  label: "Reserva 2028",
  quantity: "10",
  bookCostMinor: "80000",
  currency: "BRL",
  status: "OPEN",
  version: 1,
  allocationRevision: 1,
  valuation: {
    basis: "VALUATION",
    currentValueMinor: "85000",
    valuedAt: "2026-09-20T10:00:00Z",
    netValueMinor: "84000",
    withdrawableValueMinor: "30000",
  },
}
const summary = {
  bookId: "book-1",
  currency: "BRL",
  asOf: "2026-10-02",
  availableMinor: "120000",
  otherAssetsMinor: "0",
  archivedDailyAccountBalanceMinor: "0",
  bookNetWorthMinor: "200000",
  marketNetWorthMinor: "205000",
  investmentLedgerMinor: "100000",
  positionCostMinor: "80000",
  investmentCashMinor: "20000",
  investmentMarketValueMinor: "85000",
  unrealizedResultMinor: "5000",
  openPositionCount: 1,
  valuedPositionCount: 1,
  valuationDateRange: { oldest: "2026-09-20", newest: "2026-09-20" },
  warnings: [],
}
const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value })
const services = {
  books: {
    get: {
      execute: () =>
        ok({
          id: "book-1",
          name: "Livro UAT",
          baseCurrency: "BRL",
          timezone: "America/Sao_Paulo",
        }),
    },
    list: {
      execute: () =>
        ok([
          {
            id: "book-1",
            name: "Livro UAT",
            baseCurrency: "BRL",
            timezone: "America/Sao_Paulo",
          },
        ]),
    },
  },
  accounts: { listBalances: { execute: () => ok({ items: [] }) } },
  investments: {
    portfolio: { summary: { execute: () => ok(summary) } },
    accounts: {
      list: { execute: () => ok([account]) },
      setOpeningBalance: {
        execute: () =>
          ok({ requestId: "uat-balance", journalEntryIds: [], warnings: [] }),
      },
    },
    instruments: { list: { execute: () => ok([instrument]) } },
    positions: {
      list: { execute: () => ok({ items: [position], nextCursor: null }) },
      previewOpening: {
        execute: () =>
          ok({
            bookCostDeltaMinor: "10000",
            netCashFlowMinor: "0",
            postings: [],
            categories: {},
            projectedCashMinor: "10000",
            warnings: [],
          }),
      },
      open: {
        execute: () =>
          ok({
            requestId: "uat-open",
            positionId: "position-uat",
            journalEntryIds: [],
            warnings: [],
          }),
      },
      openWithPurchase: {
        execute: () =>
          ok({
            requestId: "uat-purchase",
            positionId: "position-uat",
            journalEntryIds: [],
            warnings: [],
          }),
      },
    },
    requests: { get: { execute: () => ok(null) } },
  },
} as unknown as MyFinServices

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <MyFinQueryProvider>
    <ActiveBookProvider initial={{ status: "ACTIVE", bookId: "book-1" }}>
      <MyFinProvider services={services}>
        <MemoryRouter initialEntries={["/investments"]}>
          <Routes>
            <Route element={<ApplicationShell />}>
              <Route path="/investments" element={<InvestmentsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MyFinProvider>
    </ActiveBookProvider>
  </MyFinQueryProvider>
)
