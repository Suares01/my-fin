/* @vitest-environment jsdom */

import type { InvestmentInstrumentDto } from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvestmentInstrumentForm } from "./investment-instrument-form"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { readonly status: "ACTIVE"; readonly bookId: string }
    | { readonly status: "INACTIVE" },
  create: vi.fn(),
  update: vi.fn(),
  setStatus: vi.fn(),
  toastAdd: vi.fn(),
  book: {
    data: { baseCurrency: "BRL" } as
      | { readonly baseCurrency: string }
      | undefined,
    isPending: false,
    isError: false,
  },
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
  useMyFin: () => ({
    investments: {
      instruments: {
        create: { execute: state.create },
        update: { execute: state.update },
        setStatus: { execute: state.setStatus },
      },
    },
  }),
}))

vi.mock("../../books/hooks", () => ({
  useBookDetail: () => state.book,
}))

vi.mock("@workspace/ui/components/toast", () => ({
  toast: { add: state.toastAdd },
}))

const instrument: InvestmentInstrumentDto = {
  id: "instrument-1",
  bookId: "book-1",
  name: "CDB banco",
  type: "CDB",
  instrumentClass: "FIXED_INCOME",
  currency: "BRL",
  identifiers: [],
  status: "ACTIVE",
  version: 3,
}

function renderForm(
  props?: Partial<React.ComponentProps<typeof InvestmentInstrumentForm>>
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <InvestmentInstrumentForm {...props} />
    </QueryClientProvider>
  )
}

function successfulCreate() {
  state.create.mockResolvedValue({ ok: true, value: instrument })
  state.update.mockResolvedValue({ ok: true, value: instrument })
  state.setStatus.mockResolvedValue({ ok: true, value: instrument })
}

describe("InvestmentInstrumentForm", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.book = {
      data: { baseCurrency: "BRL" },
      isPending: false,
      isError: false,
    }
  })

  it("waits for an active book", () => {
    state.session = { status: "INACTIVE" }
    renderForm()
    expect(screen.getByText(/Selecione um livro/i)).toBeTruthy()
  })

  it("shows a base-currency loading state", () => {
    state.book = { data: undefined, isPending: true, isError: false }
    renderForm()
    expect(screen.getByText("Carregando moeda-base")).toBeTruthy()
  })

  it("shows a book-currency error", () => {
    state.book = { data: undefined, isPending: false, isError: true }
    renderForm()
    expect(
      screen.getByText("Não foi possível carregar a moeda do livro")
    ).toBeTruthy()
  })

  it("creates an instrument using the book base currency", async () => {
    successfulCreate()
    renderForm()
    fireEvent.change(screen.getByLabelText("Nome do instrumento"), {
      target: { value: "CDB banco" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar instrumento" })
    )
    await waitFor(() =>
      expect(state.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: "book-1",
          name: "CDB banco",
          type: "CDB",
          currency: "BRL",
        })
      )
    )
  })

  it("does not send blank optional issuer or identifiers", async () => {
    successfulCreate()
    renderForm()
    fireEvent.change(screen.getByLabelText("Nome do instrumento"), {
      target: { value: "CDB banco" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar instrumento" })
    )
    await waitFor(() =>
      expect(state.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          issuerName: expect.anything(),
          identifiers: expect.anything(),
        })
      )
    )
  })

  it("allows adding and removing identifier fields", () => {
    renderForm()
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar identificador" })
    )
    expect(screen.getByLabelText("Tipo do identificador")).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: "Remover identificador" })
    )
    expect(screen.queryByLabelText("Tipo do identificador")).toBeNull()
  })

  it("keeps incomplete identifier input actionable", async () => {
    renderForm()
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar identificador" })
    )
    fireEvent.change(screen.getByLabelText("Identificador"), {
      target: { value: "ABC" },
    })
    fireEvent.change(screen.getByLabelText("Nome do instrumento"), {
      target: { value: "CDB banco" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar instrumento" })
    )
    await waitFor(() =>
      expect(
        screen.getByText("Escolha o tipo de cada identificador.")
      ).toBeTruthy()
    )
    expect(screen.getByDisplayValue("ABC")).toBeTruthy()
  })

  it("updates metadata with the current version", async () => {
    successfulCreate()
    renderForm({ mode: "edit", initialInstrument: instrument })
    fireEvent.change(screen.getByLabelText("Nome do instrumento"), {
      target: { value: "CDB atualizado" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Salvar instrumento" }))
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith(
        expect.objectContaining({
          instrumentId: "instrument-1",
          expectedVersion: 3,
          name: "CDB atualizado",
          currency: "BRL",
        })
      )
    )
  })

  it("offers archive action for active instruments", () => {
    renderForm({ mode: "edit", initialInstrument: instrument })
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    expect(
      screen.getByRole("menuitem", { name: "Arquivar instrumento" })
    ).toBeTruthy()
  })

  it("archives through the dedicated status command", async () => {
    successfulCreate()
    renderForm({ mode: "edit", initialInstrument: instrument })
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Arquivar instrumento" })
    )
    await waitFor(() =>
      expect(state.setStatus).toHaveBeenCalledWith({
        bookId: "book-1",
        instrumentId: "instrument-1",
        expectedVersion: 3,
        status: "ARCHIVED",
      })
    )
  })

  it("offers reactivation for archived instruments", () => {
    renderForm({
      mode: "edit",
      initialInstrument: { ...instrument, status: "ARCHIVED" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    expect(
      screen.getByRole("menuitem", { name: "Reativar instrumento" })
    ).toBeTruthy()
  })

  it("preserves draft and reports immutable-type errors", async () => {
    state.update.mockResolvedValue({
      ok: false,
      error: { code: "INVESTMENT_INSTRUMENT_TYPE_IMMUTABLE" },
    })
    renderForm({ mode: "edit", initialInstrument: instrument })
    fireEvent.change(screen.getByLabelText("Nome do instrumento"), {
      target: { value: "Rascunho" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Salvar instrumento" }))
    await waitFor(() =>
      expect(state.toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "O tipo e a moeda não podem mudar depois da primeira posição.",
        })
      )
    )
    expect(screen.getByDisplayValue("Rascunho")).toBeTruthy()
  })

  it("prevents duplicate submission while a save is pending", async () => {
    let resolveCreate: ((value: unknown) => void) | undefined
    state.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve
        })
    )
    renderForm()
    fireEvent.change(screen.getByLabelText("Nome do instrumento"), {
      target: { value: "CDB banco" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar instrumento" })
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Salvando instrumento" })
      ).toHaveProperty("disabled", true)
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Salvando instrumento" })
    )
    expect(state.create).toHaveBeenCalledTimes(1)
    resolveCreate?.({ ok: true, value: instrument })
  })

  it("reports an archive-in-use refusal", async () => {
    state.setStatus.mockResolvedValue({
      ok: false,
      error: { code: "INVESTMENT_INSTRUMENT_IN_USE" },
    })
    renderForm({ mode: "edit", initialInstrument: instrument })
    fireEvent.click(screen.getByRole("button", { name: "Ações" }))
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Arquivar instrumento" })
    )
    await waitFor(() =>
      expect(state.toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "Feche as posições abertas antes de arquivar este instrumento.",
        })
      )
    )
    expect(
      screen.getByText(
        "Feche as posições abertas antes de arquivar este instrumento."
      )
    ).toBeTruthy()
  })

  it("calls cancel without saving", () => {
    const onCancel = vi.fn()
    renderForm({ onCancel })
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(state.create).not.toHaveBeenCalled()
  })
})
