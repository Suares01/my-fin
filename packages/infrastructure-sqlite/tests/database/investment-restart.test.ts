import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  Currency,
  FinancialBook,
  InvestmentInstrument,
  InvestmentOperation,
  InvestmentPosition,
  LedgerAccount,
  investmentInstrumentIdFromString,
  investmentOperationIdFromString,
  investmentPositionIdFromString,
  ledgerAccountIdFromString,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentValuationQueries } from "../../src/queries/investments/sqlite-investment-valuation-queries.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteInvestmentInstrumentRepository } from "../../src/repositories/sqlite-investment-instrument-repository.js"
import { SqliteInvestmentOperationRepository } from "../../src/repositories/sqlite-investment-operation-repository.js"
import { SqliteInvestmentPositionRepository } from "../../src/repositories/sqlite-investment-position-repository.js"
import { SqliteInvestmentValuationStore } from "../../src/repositories/sqlite-investment-valuation-store.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

describe("investment records after SQLite restart", () => {
  it("reconstructs profiles, terms, positions, valuations, operations, and lineage", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "my-fin-investments-restart-")
    )
    const filename = join(directory, "finance.sqlite")
    let database: BetterSqliteDatabase | undefined
    try {
      database = new BetterSqliteDatabase(filename)
      await initializeSqliteDatabase(database, { inMemory: false })
      const bookId = "restart-book"
      const accountId = ledgerAccountIdFromString("restart-account")
      const instrumentId =
        investmentInstrumentIdFromString("restart-instrument")
      const positionId = investmentPositionIdFromString("restart-position")
      const operationId = investmentOperationIdFromString("restart-operation")

      await new SqliteFinancialBookRepository(database).add(
        FinancialBook.create({
          id: bookId as never,
          name: "Restart",
          baseCurrency: Currency.parse("BRL"),
          timezone: "America/Sao_Paulo",
        })
      )
      const account = LedgerAccount.restore({
        id: accountId,
        bookId: bookId as never,
        name: "Investimentos",
        normalizedName: "investimentos",
        kind: "ASSET",
        status: "ACTIVE",
        financialAccount: {
          type: "INVESTMENT_ACCOUNT",
          institutionName: "Banco Exemplo",
          displayReference: "Carteira principal",
        },
        version: 0,
      })
      await new SqliteLedgerAccountRepository(database).add(account)
      const instrument = InvestmentInstrument.restore({
        id: instrumentId,
        bookId: bookId as never,
        name: "CDB 2029",
        normalizedName: "cdb 2029",
        type: "CDB",
        currency: "BRL",
        identifiers: [],
        status: "ACTIVE",
        version: 0,
      })
      await new SqliteInvestmentInstrumentRepository(database).add(instrument)
      const position = InvestmentPosition.restore({
        id: positionId,
        bookId: bookId as never,
        investmentAccountId: accountId,
        instrumentId,
        label: "Reserva",
        normalizedLabel: "reserva",
        quantityMode: "UNITS",
        quantity: "10.5",
        bookCostMinor: "125000",
        currency: "BRL",
        openedOn: "2026-01-01",
        status: "OPEN",
        fixedIncomeTerms: {
          rateKind: "INDEXED",
          index: "CDI",
          indexPercentage: "105",
          maturityDate: "2029-01-01",
        },
        allocationRevision: 1,
        allocationEffectiveOn: "2026-01-01",
        version: 0,
      })
      await new SqliteInvestmentPositionRepository(database).add(position)
      await new SqliteInvestmentValuationStore(database).append({
        id: "restart-valuation" as never,
        bookId: bookId as never,
        positionId,
        allocationRevision: 1,
        valuedAt: "2026-02-01T12:00:00.000Z",
        valuedOn: "2026-02-01",
        recordedAt: "2026-02-01T13:00:00.000Z",
        recordSequence: "42",
        source: "MANUAL",
        quantity: "10.5",
        unitPrice: "130",
        currency: "BRL",
        grossValueMinor: "136500",
        netValueMinor: "136000",
        withdrawableValueMinor: "135000",
      })
      const original = InvestmentOperation.restore({
        id: operationId,
        bookId: bookId as never,
        positionId,
        type: "SALE",
        role: "BUSINESS",
        occurredOn: "2026-01-15",
        recordedAt: "2026-01-15T12:00:00.000Z",
        sequence: "1",
        description: "Venda corrigida",
        currency: "BRL",
        quantityDelta: "-2",
        bookCostDeltaMinor: "-20000",
        grossAmountMinor: "22000",
        feesMinor: "0",
        taxesMinor: "0",
        netCashFlowMinor: "22000",
        cashMode: "INTERNAL_CASH",
        categories: {},
        positionBefore: {
          kind: "EXISTING",
          quantity: "12.5",
          bookCostMinor: "145000",
          status: "OPEN",
          openedOn: "2026-01-01",
          allocationEffectiveOn: "2026-01-01",
        },
        version: 0,
      })
      const operations = new SqliteInvestmentOperationRepository(database)
      await operations.add(original)
      const reversal = InvestmentOperation.createReversal({
        id: investmentOperationIdFromString("restart-reversal"),
        original: original.toSnapshot(),
        recordedAt: "2026-02-02T12:00:00.000Z",
        sequence: "2",
      })
      await operations.add(reversal)
      original.markReversedBy(reversal.id)
      await operations.saveLineage(original, 0)
      const valuationsBeforeRestart =
        await new SqliteInvestmentValuationQueries(database).listValuations({
          bookId,
          positionId,
          limit: 10,
        })

      await database.close()
      database = new BetterSqliteDatabase(filename)
      await initializeSqliteDatabase(database, { inMemory: false })

      expect(
        (
          await new SqliteLedgerAccountRepository(database).findById(accountId)
        )?.toSnapshot()
      ).toEqual(account.toSnapshot())
      const loadedPosition = await new SqliteInvestmentPositionRepository(
        database
      ).findById(bookId, positionId)
      expect(
        loadedPosition.kind === "FOUND"
          ? loadedPosition.value.toSnapshot()
          : null
      ).toEqual(position.toSnapshot())
      const loadedInstrument = await new SqliteInvestmentInstrumentRepository(
        database
      ).findById(bookId, instrumentId)
      expect(
        loadedInstrument.kind === "FOUND"
          ? loadedInstrument.value.toSnapshot()
          : null
      ).toEqual(instrument.toSnapshot())
      const loadedOperation = await new SqliteInvestmentOperationRepository(
        database
      ).findById(bookId, operationId)
      expect(
        loadedOperation.kind === "FOUND"
          ? loadedOperation.value.toSnapshot()
          : null
      ).toEqual(original.toSnapshot())
      const loadedReversal = await new SqliteInvestmentOperationRepository(
        database
      ).findById(bookId, reversal.id)
      expect(
        loadedReversal.kind === "FOUND"
          ? loadedReversal.value.toSnapshot()
          : null
      ).toEqual(reversal.toSnapshot())
      const valuationsAfterRestart = await new SqliteInvestmentValuationQueries(
        database
      ).listValuations({ bookId, positionId, limit: 10 })
      expect(valuationsAfterRestart).toEqual(valuationsBeforeRestart)
      expect(valuationsAfterRestart).toMatchObject({
        items: [
          {
            id: "restart-valuation",
            allocationRevision: 1,
            recordSequence: "42",
            quantity: "10.5",
            unitPrice: "130",
            grossValueMinor: "136500",
            netValueMinor: "136000",
            withdrawableValueMinor: "135000",
          },
        ],
      })
    } finally {
      await database?.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
