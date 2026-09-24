import type {
  FeeOrTaxDraft,
  InvestmentPositionView,
} from "@workspace/application"
import { z } from "zod"
import { parseOpeningMoney } from "./open-investment-position-form-model"

export const expenseFormSchema = z.object({
  type: z.enum(["FEE", "TAX"]),
  amountDisplay: z.string(),
  expenseCategoryId: z.string(),
  occurredOn: z.string(),
  description: z.string(),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export const expenseFormDefaults: ExpenseFormValues = {
  type: "FEE",
  amountDisplay: "",
  expenseCategoryId: "",
  occurredOn: "",
  description: "",
}

type ValidationResult =
  | { readonly ok: true; readonly draft: FeeOrTaxDraft }
  | {
      readonly ok: false
      readonly field: keyof ExpenseFormValues
      readonly message: string
    }

export function buildExpenseDraft(input: {
  readonly values: ExpenseFormValues
  readonly position: InvestmentPositionView
  readonly bookId: string
  readonly requestId: string
  readonly expenseCategoryIds: readonly string[]
}): ValidationResult {
  const { values, position, bookId, requestId, expenseCategoryIds } = input
  const amountMinor = parseOpeningMoney(values.amountDisplay)
  if (amountMinor === null || amountMinor === "0")
    return {
      ok: false,
      field: "amountDisplay",
      message: "Informe um valor pago maior que zero.",
    }
  if (!expenseCategoryIds.includes(values.expenseCategoryId))
    return {
      ok: false,
      field: "expenseCategoryId",
      message: "Escolha a categoria de despesa.",
    }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.occurredOn) ||
    Number.isNaN(Date.parse(values.occurredOn + "T00:00:00Z"))
  )
    return {
      ok: false,
      field: "occurredOn",
      message: "Informe uma data válida.",
    }
  return {
    ok: true,
    draft: {
      bookId,
      requestId,
      positionId: position.id,
      expectedPositionVersion: position.version,
      type: values.type,
      amountMinor,
      expenseCategoryId: values.expenseCategoryId,
      cashMode: "INTERNAL_CASH",
      occurredOn: values.occurredOn,
      description:
        values.description.trim() ||
        (values.type === "FEE"
          ? "Taxa de investimento"
          : "Imposto de investimento"),
      currency: position.currency,
    },
  }
}

export function expenseErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined
  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "A posição mudou. Atualize a posição e revise a despesa."
    case "INVALID_INVESTMENT_CATEGORY":
      return "A categoria mudou. Atualize as categorias e revise a despesa."
    case "INVALID_INVESTMENT_OPERATION":
      return "A despesa não é mais válida. Revise o valor e tente novamente."
    case "INVESTMENT_ENTITY_NOT_ACTIVE":
      return "A conta ou o instrumento foi arquivado. Atualize a posição antes de continuar."
    case "IDEMPOTENCY_CONFLICT":
      return "Esta tentativa já foi usada com outros dados. Revise e tente novamente."
    default:
      return "Não foi possível salvar a despesa. Os dados foram preservados; tente novamente."
  }
}
