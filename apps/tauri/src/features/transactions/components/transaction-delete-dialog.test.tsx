/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalChainDetail } from "@workspace/application"
import { TransactionDeleteDialog } from "./transaction-delete-dialog.js"
import { localCivilDate } from "../transaction-form-model.js"
const detail = {
  chainId: "chain-1",
  occurredOn: "2026-09-03",
  description: "Mercado",
  presentedEntryId: "entry-1",
  presentedVersion: 1,
} as unknown as JournalChainDetail
function renderDialog(
  overrides: Partial<React.ComponentProps<typeof TransactionDeleteDialog>> = {}
) {
  const props = {
    detail,
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<TransactionDeleteDialog {...props} />) }
}
beforeEach(() => undefined)
afterEach(cleanup)
describe("TransactionDeleteDialog", () => {
  it("explains cancellation and preserved history", () => {
    renderDialog()
    expect(
      screen.getByText(
        "O efeito financeiro será cancelado, mas o histórico da transação será preservado."
      )
    ).toBeTruthy()
  })
  it("defaults to the local civil date", () => {
    renderDialog()
    expect(
      screen.getByLabelText("Data de cancelamento").getAttribute("value")
    ).toBe(localCivilDate())
  })
  it("allows changing the cancellation date", () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText("Data de cancelamento"), {
      target: { value: "2026-09-05" },
    })
    expect(
      screen.getByLabelText("Data de cancelamento").getAttribute("value")
    ).toBe("2026-09-05")
  })
  it("builds the system cancellation explanation", () => {
    renderDialog()
    expect(
      screen.getByLabelText("Descrição do cancelamento").getAttribute("value")
    ).toBe("Cancelamento de: Mercado")
  })
  it("sends exactly one valid confirmation payload", async () => {
    const { props } = renderDialog()
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    )
    await waitFor(() =>
      expect(props.onConfirm).toHaveBeenCalledWith({
        occurredOn: localCivilDate(),
        description: "Cancelamento de: Mercado",
      })
    )
  })
  it("rejects an invalid civil date", async () => {
    const { props } = renderDialog()
    fireEvent.change(screen.getByLabelText("Data de cancelamento"), {
      target: { value: "2026-02-30" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    )
    expect(
      await screen.findByText("Informe uma data válida no formato AAAA-MM-DD.")
    ).toBeTruthy()
    expect(props.onConfirm).not.toHaveBeenCalled()
  })
  it("rejects a date before the presented transaction", async () => {
    const { props } = renderDialog()
    fireEvent.change(screen.getByLabelText("Data de cancelamento"), {
      target: { value: "2026-09-02" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    )
    expect(
      await screen.findByText(
        "A data de cancelamento não pode ser anterior ao lançamento."
      )
    ).toBeTruthy()
    expect(props.onConfirm).not.toHaveBeenCalled()
  })
  it("disables confirmation while pending without optimistic removal", () => {
    renderDialog({ pending: true })
    expect(
      screen
        .getByRole("button", { name: "Cancelando transação" })
        .hasAttribute("disabled")
    ).toBe(true)
    expect(screen.getByRole("dialog")).toBeTruthy()
  })
  it("rejects a duplicate confirmation while the first is pending", async () => {
    let release!: () => void
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    renderDialog({ onConfirm })
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    )
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())
    fireEvent.click(
      screen.getByRole("button", { name: "Cancelando transação" })
    )
    expect(onConfirm).toHaveBeenCalledOnce()
    release()
  })
  it("keeps the dialog open and date after service failure", async () => {
    const { props } = renderDialog({
      onConfirm: vi.fn().mockRejectedValue(new Error("offline")),
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    )
    expect(
      await screen.findByText("Não foi possível cancelar a transação")
    ).toBeTruthy()
    expect(
      screen.getByLabelText("Data de cancelamento").getAttribute("value")
    ).toBe(localCivilDate())
    expect(props.onConfirm).toHaveBeenCalledOnce()
  })
  it("locks confirmation after an optimistic conflict", async () => {
    const conflict = Object.assign(new Error("changed"), {
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    renderDialog({ onConfirm: vi.fn().mockRejectedValue(conflict) })
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    )
    expect(await screen.findByText("Este lançamento mudou")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Cancelando transação" })
        .hasAttribute("disabled")
    ).toBe(true)
  })
  it("has accessible dialog and cancel controls", () => {
    const { props } = renderDialog()
    expect(
      screen.getByRole("dialog", { name: "Cancelar transação" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }))
    expect(props.onCancel).toHaveBeenCalledOnce()
  })
})
