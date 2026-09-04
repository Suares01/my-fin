/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  emptyTransactionFilters,
  TransactionFilters,
} from "./transaction-filters.js"

describe("TransactionFilters period visibility", () => {
  it("keeps the internal period out of the user interface", () => {
    render(
      <TransactionFilters
        filters={emptyTransactionFilters}
        accounts={[]}
        categories={[]}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    )

    expect(screen.queryByLabelText("De")).toBeNull()
    expect(screen.queryByLabelText("Até")).toBeNull()
  })
})
