/* @vitest-environment jsdom */

import type { InvestmentPositionMetadataDto } from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvestmentPositionMetadataForm } from "./investment-position-metadata-form"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { readonly status: "ACTIVE"; readonly bookId: string }
    | { readonly status: "INACTIVE" },
  update: vi.fn(),
  toastAdd: vi.fn(),
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
  useMyFin: () => ({
    investments: { positions: { updateMetadata: { execute: state.update } } },
  }),
}))

vi.mock("@workspace/ui/components/toast", () => ({
  toast: { add: state.toastAdd },
}))

const position: InvestmentPositionMetadataDto = {
  id: "position-1",
  bookId: "book-1",
  label: "Reserva",
  version: 4,
}

function renderForm(
  props?: Partial<React.ComponentProps<typeof InvestmentPositionMetadataForm>>
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <InvestmentPositionMetadataForm position={position} {...props} />
    </QueryClientProvider>
  )
}

describe("InvestmentPositionMetadataForm", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    state.session = { status: "ACTIVE", bookId: "book-1" }
  })

  it("requires an active book", () => {
    state.session = { status: "INACTIVE" }
    renderForm()
    expect(screen.getByText(/Selecione um livro/i)).toBeTruthy()
  })

  it("shows terms as read-only context", () => {
    renderForm({ terms: [{ label: "Vencimento", value: "2030-01-01" }] })
    expect(screen.getByLabelText("Termos da posição")).toBeTruthy()
    expect(screen.getByText("2030-01-01")).toBeTruthy()
    expect(
      screen.getByText(
        /Quantidade, custo e revisão de alocação são termos imutáveis/i
      )
    ).toBeTruthy()
  })

  it("submits only the dedicated metadata payload", async () => {
    state.update.mockResolvedValue({ ok: true, value: position })
    renderForm()
    fireEvent.change(screen.getByLabelText("Rótulo da posição"), {
      target: { value: "Liquidez" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Salvar rótulo" }))
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        bookId: "book-1",
        positionId: "position-1",
        expectedVersion: 4,
        label: "Liquidez",
      })
    )
    expect(state.update.mock.calls[0]?.[0]).not.toHaveProperty("bookCostMinor")
    expect(state.update.mock.calls[0]?.[0]).not.toHaveProperty("quantity")
    expect(state.update.mock.calls[0]?.[0]).not.toHaveProperty(
      "allocationRevision"
    )
  })

  it("clears a blank label without economic fields", async () => {
    state.update.mockResolvedValue({ ok: true, value: position })
    renderForm()
    fireEvent.change(screen.getByLabelText("Rótulo da posição"), {
      target: { value: " " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Salvar rótulo" }))
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        bookId: "book-1",
        positionId: "position-1",
        expectedVersion: 4,
      })
    )
  })

  it("retains the draft after a concurrency conflict", async () => {
    state.update.mockResolvedValue({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    renderForm()
    fireEvent.change(screen.getByLabelText("Rótulo da posição"), {
      target: { value: "Rascunho" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Salvar rótulo" }))
    await waitFor(() =>
      expect(state.toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "Esta posição foi alterada. Atualize os dados e tente novamente.",
        })
      )
    )
    expect(screen.getByDisplayValue("Rascunho")).toBeTruthy()
  })

  it("prevents duplicate save while pending", async () => {
    let resolveUpdate: ((value: unknown) => void) | undefined
    state.update.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve
        })
    )
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Salvar rótulo" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Salvando rótulo" })
      ).toHaveProperty("disabled", true)
    )
    fireEvent.click(screen.getByRole("button", { name: "Salvando rótulo" }))
    expect(state.update).toHaveBeenCalledTimes(1)
    resolveUpdate?.({ ok: true, value: position })
  })

  it("cancels without issuing an update", () => {
    const onCancel = vi.fn()
    renderForm({ onCancel })
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(state.update).not.toHaveBeenCalled()
  })
})
