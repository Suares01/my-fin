/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { readonly status: "ACTIVE"; readonly bookId: string }
    | { readonly status: "UNRESOLVED" },
  mutateAsync: vi.fn(),
  configureAsync: vi.fn(),
  isPending: false,
  configurePending: false,
  error: null as unknown,
  toastAdd: vi.fn(),
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))

vi.mock("../hooks", () => ({
  useCreateAccount: () => ({
    mutateAsync: state.mutateAsync,
    isPending: state.isPending,
    isError: state.error !== null,
    error: state.error,
  }),
  useConfigureAccount: () => ({
    mutateAsync: state.configureAsync,
    isPending: state.configurePending,
  }),
}))

vi.mock("@workspace/ui/components/toast", () => ({
  toast: { add: state.toastAdd },
}))

import { AccountForm } from "./account-form"
import { accountErrorMessage } from "./account-form-model"

describe("AccountForm", () => {
  afterEach(() => {
    cleanup()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.mutateAsync.mockReset()
    state.configureAsync.mockReset()
    state.isPending = false
    state.configurePending = false
    state.error = null
    state.toastAdd.mockReset()
  })

  it("starts with the name field and Asset selected", () => {
    render(<AccountForm />)

    expect(screen.getByLabelText("Nome da conta")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Ativo" }).getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Passivo" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("validates the name through the resolver before sending a command", async () => {
    render(<AccountForm />)

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    expect(
      await screen.findByText("Informe um nome para a conta.")
    ).toBeTruthy()
    expect(state.mutateAsync).not.toHaveBeenCalled()
  })

  it("requires a selected account kind before sending a command", async () => {
    render(<AccountForm />)

    fireEvent.click(screen.getByRole("button", { name: "Ativo" }))
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    expect(await screen.findByText("Escolha Ativo ou Passivo.")).toBeTruthy()
    expect(state.mutateAsync).not.toHaveBeenCalled()
  })

  it("submits a trimmed command scoped to the active book", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    render(<AccountForm />)

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "  Carteira  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledOnce())
    expect(state.mutateAsync).toHaveBeenCalledWith({
      bookId: "book-1",
      name: "Carteira",
      type: "OTHER_ASSET",
    })
  })

  it("submits Liability when Passivo is selected", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    render(<AccountForm />)

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "Cartão" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Passivo" }))
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        name: "Cartão",
        type: "OTHER_LIABILITY",
      })
    )
  })

  it("keeps entered values and shows a safe toast after failure", async () => {
    state.mutateAsync.mockRejectedValue(new Error("/private/vault.sqlite"))
    render(<AccountForm />)

    const name = screen.getByLabelText("Nome da conta") as HTMLInputElement
    fireEvent.change(name, { target: { value: "Reserva" } })
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    expect(state.toastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível criar a conta",
      description: "Não foi possível criar a conta. Tente novamente.",
    })
    expect(name.value).toBe("Reserva")
    expect(screen.queryByText(/vault\.sqlite/)).toBeNull()
  })

  it("blocks controls while creating", () => {
    state.isPending = true
    render(<AccountForm onCancel={vi.fn()} />)

    expect(
      screen.getByLabelText("Nome da conta").hasAttribute("disabled")
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Ativo" })
        .getAttribute("aria-disabled")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Passivo" })
        .getAttribute("aria-disabled")
    ).toBe("true")
    expect(
      screen.getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Criando conta" })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("does not render the form without an active book", () => {
    state.session = { status: "UNRESOLVED" }
    render(<AccountForm />)

    expect(screen.getByRole("alert").textContent).toContain(
      "Selecione um livro"
    )
    expect(screen.queryByLabelText("Nome da conta")).toBeNull()
  })

  it("maps known and unknown errors without exposing internals", () => {
    expect(accountErrorMessage({ code: "DUPLICATE_ENTITY" })).toBe(
      "Já existe uma conta com esse nome e tipo."
    )
    expect(accountErrorMessage({ message: "secret path" })).not.toContain(
      "secret path"
    )
  })

  it("offers every financial purpose and explains that other assets stay outside available money", () => {
    render(<AccountForm />)

    expect(screen.getByRole("button", { name: "Banco" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Investimento" })).toBeTruthy()
    expect(
      screen.getByText(/Outro ativo fica fora do dinheiro disponível/i)
    ).toBeTruthy()
  })

  it("creates an investment account with optional institution, reference and explicit settlement", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    render(
      <AccountForm settlementAccounts={[{ id: "bank-1", name: "Banco" }]} />
    )

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: " Carteira XP " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Investimento" }))
    fireEvent.change(screen.getByLabelText("Instituição"), {
      target: { value: " XP " },
    })
    fireEvent.change(screen.getByLabelText("Referência"), {
      target: { value: " 123 " },
    })
    fireEvent.click(
      screen.getByRole("combobox", { name: "Conta padrão de liquidação" })
    )
    const settlement = screen.getByRole("option", { name: "Banco" })
    fireEvent.pointerDown(settlement)
    fireEvent.click(settlement)
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Conta padrão de liquidação" })
          .textContent
      ).toContain("Banco")
    )
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        name: "Carteira XP",
        type: "INVESTMENT_ACCOUNT",
        institutionName: "XP",
        displayReference: "123",
        defaultSettlementAccountId: "bank-1",
      })
    )
  })

  it("does not send a settlement account for a non-investment purpose", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    render(<AccountForm />)

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "Banco" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Banco" }))
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        name: "Banco",
        type: "BANK_ACCOUNT",
      })
    )
  })

  it("allows an investment account without an institution or default settlement", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    render(<AccountForm />)

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "Carteira" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Investimento" }))
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        name: "Carteira",
        type: "INVESTMENT_ACCOUNT",
      })
    )
  })

  it("prefills the existing investment profile including its settlement account", () => {
    render(
      <AccountForm
        mode="edit"
        initialAccount={{
          accountId: "account-1",
          accountName: "Carteira XP",
          accountKind: "ASSET",
          rawBalanceMinor: "0",
          displayBalanceMinor: "0",
          amountMinor: "0",
          currency: "BRL",
          asOf: null,
          archived: false,
          version: 4,
          financialAccount: {
            type: "INVESTMENT_ACCOUNT",
            institutionName: "XP",
            displayReference: "123",
            defaultSettlementAccountId: "bank-1",
          },
        }}
        settlementAccounts={[{ id: "bank-1", name: "Banco" }]}
      />
    )

    expect(screen.queryByLabelText("Nome da conta")).toBeNull()
    expect(
      screen
        .getByRole("button", { name: "Investimento" })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      (screen.getByLabelText("Instituição") as HTMLInputElement).value
    ).toBe("XP")
    expect(
      (screen.getByLabelText("Referência") as HTMLInputElement).value
    ).toBe("123")
    expect(
      screen.getByRole("combobox", { name: "Conta padrão de liquidação" })
        .textContent
    ).toContain("Banco")
  })

  it("does not expose the settlement control until investment is selected", () => {
    render(<AccountForm />)

    expect(
      screen.queryByRole("combobox", { name: "Conta padrão de liquidação" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Investimento" }))
    expect(
      screen.getByRole("combobox", { name: "Conta padrão de liquidação" })
    ).toBeTruthy()
  })

  it("keeps profile fields available after invalid settlement rejection", async () => {
    state.configureAsync.mockRejectedValue({
      code: "INVALID_SETTLEMENT_ACCOUNT",
    })
    render(
      <AccountForm
        mode="edit"
        initialAccount={{
          accountId: "account-1",
          accountName: "Carteira",
          accountKind: "ASSET",
          rawBalanceMinor: "0",
          displayBalanceMinor: "0",
          amountMinor: "0",
          currency: "BRL",
          asOf: null,
          archived: false,
          version: 1,
          financialAccount: { type: "INVESTMENT_ACCOUNT" },
        }}
      />
    )

    fireEvent.change(screen.getByLabelText("Instituição"), {
      target: { value: "Corretora" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar classificação" })
    )

    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    expect(state.toastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível salvar a classificação",
      description:
        "Escolha uma conta bancária ou de pagamento ativa deste livro para liquidação.",
    })
    expect(
      (screen.getByLabelText("Instituição") as HTMLInputElement).value
    ).toBe("Corretora")
  })

  it("disables every edit control while a reclassification is pending", () => {
    state.configurePending = true
    render(
      <AccountForm
        mode="edit"
        initialAccount={{
          accountId: "account-1",
          accountName: "Carteira",
          accountKind: "ASSET",
          rawBalanceMinor: "0",
          displayBalanceMinor: "0",
          amountMinor: "0",
          currency: "BRL",
          asOf: null,
          archived: false,
          version: 1,
          financialAccount: { type: "OTHER_ASSET" },
        }}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByLabelText("Instituição").hasAttribute("disabled")).toBe(
      true
    )
    expect(
      screen
        .getByRole("button", { name: "Ativo" })
        .getAttribute("aria-disabled")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Salvando classificação" })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("reclassifies an existing account without creating postings or changing its identity", async () => {
    state.configureAsync.mockResolvedValue({ id: "account-1" })
    render(
      <AccountForm
        mode="edit"
        initialAccount={{
          accountId: "account-1",
          accountName: "Reserva",
          accountKind: "ASSET",
          rawBalanceMinor: "0",
          displayBalanceMinor: "0",
          amountMinor: "0",
          currency: "BRL",
          asOf: null,
          archived: false,
          version: 4,
          financialAccount: { type: "OTHER_ASSET" },
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Banco" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar classificação" })
    )

    await waitFor(() =>
      expect(state.configureAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        accountId: "account-1",
        expectedVersion: 4,
        profile: { type: "BANK_ACCOUNT" },
      })
    )
    expect(state.mutateAsync).not.toHaveBeenCalled()
  })

  it("sets the selected settlement while reclassifying into an investment account", async () => {
    state.configureAsync.mockResolvedValue({ id: "account-1" })
    render(
      <AccountForm
        mode="edit"
        initialAccount={{
          accountId: "account-1",
          accountName: "Reserva",
          accountKind: "ASSET",
          rawBalanceMinor: "0",
          displayBalanceMinor: "0",
          amountMinor: "0",
          currency: "BRL",
          asOf: null,
          archived: false,
          version: 4,
          financialAccount: { type: "OTHER_ASSET" },
        }}
        settlementAccounts={[{ id: "bank-1", name: "Banco" }]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Investimento" }))
    fireEvent.click(
      screen.getByRole("combobox", { name: "Conta padrão de liquidação" })
    )
    const settlement = screen.getByRole("option", { name: "Banco" })
    fireEvent.pointerDown(settlement)
    fireEvent.click(settlement)
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar classificação" })
    )

    await waitFor(() =>
      expect(state.configureAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        accountId: "account-1",
        expectedVersion: 4,
        profile: {
          type: "INVESTMENT_ACCOUNT",
          defaultSettlementAccountId: "bank-1",
        },
      })
    )
  })

  it("clears the default settlement when none is explicitly selected", async () => {
    state.configureAsync.mockResolvedValue({ id: "account-1" })
    render(
      <AccountForm
        mode="edit"
        initialAccount={{
          accountId: "account-1",
          accountName: "Reserva",
          accountKind: "ASSET",
          rawBalanceMinor: "0",
          displayBalanceMinor: "0",
          amountMinor: "0",
          currency: "BRL",
          asOf: null,
          archived: false,
          version: 4,
          financialAccount: {
            type: "INVESTMENT_ACCOUNT",
            defaultSettlementAccountId: "bank-1",
          },
        }}
        settlementAccounts={[{ id: "bank-1", name: "Banco" }]}
      />
    )

    fireEvent.click(
      screen.getByRole("combobox", { name: "Conta padrão de liquidação" })
    )
    const noSettlement = screen.getByRole("option", {
      name: "Sem conta padrão",
    })
    fireEvent.pointerDown(noSettlement)
    fireEvent.click(noSettlement)
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar classificação" })
    )

    await waitFor(() =>
      expect(state.configureAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        accountId: "account-1",
        expectedVersion: 4,
        profile: { type: "INVESTMENT_ACCOUNT" },
      })
    )
  })

  it("keeps the reclassification draft and reports a stable domain error", async () => {
    state.configureAsync.mockRejectedValue({
      code: "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED",
    })
    render(
      <AccountForm
        mode="edit"
        initialAccount={{
          accountId: "account-1",
          accountName: "Carteira",
          accountKind: "ASSET",
          rawBalanceMinor: "0",
          displayBalanceMinor: "0",
          amountMinor: "0",
          currency: "BRL",
          asOf: null,
          archived: false,
          version: 1,
          financialAccount: { type: "INVESTMENT_ACCOUNT" },
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Ativo" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar classificação" })
    )

    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    expect(state.toastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível salvar a classificação",
      description:
        "Esta classificação não pode ser alterada enquanto a conta estiver em uso.",
    })
    expect(
      screen.getByRole("button", { name: "Ativo" }).getAttribute("aria-pressed")
    ).toBe("true")
  })
})
