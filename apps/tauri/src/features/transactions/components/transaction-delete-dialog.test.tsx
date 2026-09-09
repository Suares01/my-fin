/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalChainDetail } from "@workspace/application"
import { toast } from "@workspace/ui/components/toast"
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

function FocusLifecycleHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir cancelamento
      </button>
      {open ? (
        <TransactionDeleteDialog
          detail={detail}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

beforeEach(() => undefined)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
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
    expect(screen.getByLabelText("Data de cancelamento").textContent).toContain(
      "de"
    )
  })
  it("allows changing the cancellation date", () => {
    renderDialog()
    fireEvent.click(screen.getByLabelText("Data de cancelamento"))
    fireEvent.click(
      screen.getByRole("button", { name: "sábado, 5 de setembro de 2026" })
    )
    expect(screen.getByLabelText("Data de cancelamento").textContent).toContain(
      "5 de setembro de 2026"
    )
  })
  it("builds the system cancellation explanation", () => {
    renderDialog()
    expect(
      screen.getByLabelText("Descrição do cancelamento").getAttribute("value")
    ).toBe("Cancelamento de: Mercado")
    expect(
      screen
        .getByLabelText("Descrição do cancelamento")
        .hasAttribute("readonly")
    ).toBe(true)
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
  it("rejects a date before the presented transaction", async () => {
    const { props } = renderDialog()
    fireEvent.click(screen.getByLabelText("Data de cancelamento"))
    fireEvent.click(
      screen.getByRole("button", {
        name: "quarta-feira, 2 de setembro de 2026",
      })
    )
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
    const add = vi.spyOn(toast, "add").mockReturnValue("toast-id")
    const { props } = renderDialog({
      onConfirm: vi.fn().mockRejectedValue(new Error("offline")),
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    )
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        type: "error",
        title: "Não foi possível cancelar a transação",
        description: "Não foi possível cancelar a transação. Tente novamente.",
      })
    )
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByLabelText("Data de cancelamento").textContent).toContain(
      "de"
    )
    expect(props.onConfirm).toHaveBeenCalledOnce()
  })
  it("notifies a retained submit error through a toast", async () => {
    const add = vi.spyOn(toast, "add").mockReturnValue("toast-id")
    const { props, rerender } = renderDialog()
    const error = new Error("offline")

    rerender(<TransactionDeleteDialog {...props} submitError={error} />)

    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        type: "error",
        title: "Não foi possível cancelar a transação",
        description: "Não foi possível cancelar a transação. Tente novamente.",
      })
    )
    expect(screen.queryByRole("alert")).toBeNull()
  })
  it("locks confirmation after an optimistic conflict", async () => {
    const add = vi.spyOn(toast, "add").mockReturnValue("toast-id")
    const conflict = Object.assign(new Error("changed"), {
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    renderDialog({ onConfirm: vi.fn().mockRejectedValue(conflict) })
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    )
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        type: "error",
        title: "Não foi possível cancelar a transação",
        description:
          "Este lançamento mudou. Atualize os dados antes de tentar novamente.",
      })
    )
    expect(screen.queryByRole("alert")).toBeNull()
    expect(
      screen
        .getByRole("button", { name: "Cancelando transação" })
        .hasAttribute("disabled")
    ).toBe(true)
  })
  it("has accessible dialog and cancel controls", () => {
    const { props } = renderDialog()
    expect(
      screen.getByRole("dialog", { name: "Cancelar lançamento" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }))
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it("closes the cancellation drawer with Escape", async () => {
    render(<FocusLifecycleHarness />)
    const trigger = screen.getByRole("button", {
      name: "Abrir cancelamento",
    })
    trigger.focus()
    fireEvent.click(trigger)

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(trigger).toBeTruthy()
  })
})
