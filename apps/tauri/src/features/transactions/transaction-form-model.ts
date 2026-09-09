import { z } from "zod"
import type {
  JournalBusinessDraft,
  JournalChainDetail,
} from "@workspace/application"

const MAX_AMOUNT_MINOR = "9223372036854775807"
const amountPattern = /^[1-9]\d*$/
const civilDatePattern = /^\d{4}-\d{2}-\d{2}$/

export const amountMinorSchema = z
  .string()
  .regex(amountPattern, "Informe um valor inteiro positivo.")
  .refine(
    (value) =>
      !amountPattern.test(value) || BigInt(value) <= BigInt(MAX_AMOUNT_MINOR),
    {
      message: "Informe um valor de até 9223372036854775807.",
    }
  )

export const civilDateSchema = z
  .string()
  .regex(civilDatePattern, "Informe uma data válida no formato AAAA-MM-DD.")
  .refine(isValidCivilDate, "Informe uma data válida no formato AAAA-MM-DD.")

export const descriptionSchema = z
  .string()
  .trim()
  .min(1, "Informe uma descrição.")

const sharedDraftFields = {
  amountMinor: amountMinorSchema,
  currency: z.string().trim().min(1, "Informe a moeda do livro."),
  occurredOn: civilDateSchema,
  description: descriptionSchema,
}

export const incomeDraftSchema = z.object({
  type: z.literal("INCOME"),
  accountId: z.string().min(1, "Selecione uma conta."),
  categoryId: z.string().min(1, "Selecione uma categoria."),
  ...sharedDraftFields,
})

export const expenseDraftSchema = z.object({
  type: z.literal("EXPENSE"),
  accountId: z.string().min(1, "Selecione uma conta."),
  categoryId: z.string().min(1, "Selecione uma categoria."),
  ...sharedDraftFields,
})

export const transferDraftSchema = z
  .object({
    type: z.literal("TRANSFER"),
    sourceAccountId: z.string().min(1, "Selecione a conta de origem."),
    destinationAccountId: z.string().min(1, "Selecione a conta de destino."),
    ...sharedDraftFields,
  })
  .refine((draft) => draft.sourceAccountId !== draft.destinationAccountId, {
    path: ["destinationAccountId"],
    message: "Escolha contas diferentes.",
  })

export function cancellationSchema(presentedOccurredOn: string) {
  return z
    .object({ occurredOn: civilDateSchema, description: descriptionSchema })
    .refine((input) => input.occurredOn >= presentedOccurredOn, {
      path: ["occurredOn"],
      message: "A data de cancelamento não pode ser anterior ao lançamento.",
    })
}

export function isValidCivilDate(value: string): boolean {
  if (!civilDatePattern.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function localCivilDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function validateCancellationDate(
  occurredOn: string,
  presentedOccurredOn: string
): string | undefined {
  if (!isValidCivilDate(occurredOn)) {
    return "Informe uma data válida no formato AAAA-MM-DD."
  }
  return occurredOn < presentedOccurredOn
    ? "A data de cancelamento não pode ser anterior ao lançamento."
    : undefined
}

export type EditDraftResult =
  | { readonly ok: true; readonly draft: JournalBusinessDraft }
  | { readonly ok: false; readonly reason: "AMBIGUOUS_DETAIL" }

export function editDraftFromDetail(
  detail: JournalChainDetail
): EditDraftResult {
  const shared = {
    amountMinor: detail.amountMinor,
    currency: detail.currency,
    occurredOn: detail.occurredOn,
    description: detail.description,
  }

  if (detail.type === "TRANSFER") {
    if (detail.transfer === undefined)
      return { ok: false, reason: "AMBIGUOUS_DETAIL" }
    return {
      ok: true,
      draft: {
        type: "TRANSFER",
        sourceAccountId: detail.transfer.source.id,
        destinationAccountId: detail.transfer.destination.id,
        ...shared,
      },
    }
  }

  if (detail.type === "INCOME" || detail.type === "EXPENSE") {
    const account = detail.financialAccounts.at(0)
    const category = detail.categories.at(0)
    if (
      detail.financialAccounts.length !== 1 ||
      detail.categories.length !== 1 ||
      account === undefined ||
      category === undefined
    ) {
      return { ok: false, reason: "AMBIGUOUS_DETAIL" }
    }
    return {
      ok: true,
      draft: {
        type: detail.type,
        accountId: account.id,
        categoryId: category.id,
        ...shared,
      },
    }
  }

  return { ok: false, reason: "AMBIGUOUS_DETAIL" }
}

export function affectedAccountIds(
  draft: JournalBusinessDraft,
  previousDetail?: JournalChainDetail
): readonly string[] {
  const currentIds =
    draft.type === "TRANSFER"
      ? [draft.sourceAccountId, draft.destinationAccountId]
      : [draft.accountId]
  const previousIds =
    previousDetail?.financialAccounts.map((account) => account.id) ?? []
  return [...new Set([...previousIds, ...currentIds])]
}

export function transactionErrorMessage(
  error: unknown,
  action: "salvar" | "cancelar" = "salvar"
): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined

  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "Este lançamento mudou. Atualize os dados antes de tentar novamente."
    case "ENTITY_NOT_FOUND":
      return "A conta, categoria ou livro não está mais disponível."
    case "INVALID_ACCOUNT_STATUS":
      return "A conta ou categoria selecionada não está ativa."
    case "JOURNAL_ENTRY_NOT_EFFECTIVE":
      return "Este lançamento não pode mais ser alterado."
    default:
      return `Não foi possível ${action} a transação. Tente novamente.`
  }
}
