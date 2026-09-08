/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useTransactionCreateDrawer } from "./use-transaction-create-drawer.js"

describe("useTransactionCreateDrawer", () => {
  it("opens the requested transaction type", () => {
    const { result } = renderHook(() => useTransactionCreateDrawer())

    act(() => result.current.openCreateForm("TRANSFER"))

    expect(result.current.createDrawerOpen).toBe(true)
    expect(result.current.creatingTransactionType).toBe("TRANSFER")
  })

  it("clears the selected type when closed through the controlled callback", () => {
    const { result } = renderHook(() => useTransactionCreateDrawer())

    act(() => result.current.openCreateForm("EXPENSE"))
    act(() => result.current.setCreateDrawerOpen(false))

    expect(result.current.createDrawerOpen).toBe(false)
    expect(result.current.creatingTransactionType).toBeUndefined()
  })

  it("clears the selected type when explicitly cancelled", () => {
    const { result } = renderHook(() => useTransactionCreateDrawer())

    act(() => result.current.openCreateForm("INCOME"))
    act(() => result.current.closeCreateForm())

    expect(result.current.createDrawerOpen).toBe(false)
    expect(result.current.creatingTransactionType).toBeUndefined()
  })
})
