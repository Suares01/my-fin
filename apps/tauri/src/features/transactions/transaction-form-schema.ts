import { z } from "zod"
import {
  incomeDraftSchema,
  expenseDraftSchema,
  transferDraftSchema,
} from "./transaction-form-model"

export const valueCentsSchema = z
  .number({ error: "Informe um valor inteiro positivo." })
  .int("Informe um valor inteiro seguro.")
  .positive("Informe um valor inteiro positivo.")
  .max(Number.MAX_SAFE_INTEGER, "O valor excede o limite seguro do formulário.")

const sharedFields = {
  valueCents: valueCentsSchema,
  currency: incomeDraftSchema.shape.currency,
  occurredOn: incomeDraftSchema.shape.occurredOn,
  description: incomeDraftSchema.shape.description,
}
const accountCategoryFields = {
  accountId: incomeDraftSchema.shape.accountId,
  categoryId: incomeDraftSchema.shape.categoryId,
}

function toDraft<T extends { valueCents: number }>(values: T) {
  const { valueCents, ...draft } = values
  return { ...draft, amountMinor: String(valueCents) }
}

export const incomeFormSchema = z
  .object({
    type: z.literal("INCOME"),
    ...accountCategoryFields,
    ...sharedFields,
  })
  .transform(toDraft)
  .pipe(incomeDraftSchema)

export const expenseFormSchema = z
  .object({
    type: z.literal("EXPENSE"),
    ...accountCategoryFields,
    ...sharedFields,
  })
  .transform(toDraft)
  .pipe(expenseDraftSchema)

export const transferFormSchema = z
  .object({
    type: z.literal("TRANSFER"),
    sourceAccountId: transferDraftSchema.shape.sourceAccountId,
    destinationAccountId: transferDraftSchema.shape.destinationAccountId,
    ...sharedFields,
  })
  .transform(toDraft)
  .pipe(transferDraftSchema)

export type TransactionCommonValues = Pick<
  z.input<typeof incomeFormSchema>,
  "valueCents" | "currency" | "occurredOn" | "description"
>

export function initialValueCents(amountMinor?: string): number | null {
  if (amountMinor === undefined) return 0
  if (
    !/^\d+$/.test(amountMinor) ||
    BigInt(amountMinor) > BigInt(Number.MAX_SAFE_INTEGER)
  )
    return null
  return Number(amountMinor)
}

export function transactionCommonDefaults(
  draft:
    | {
        amountMinor: string
        currency: string
        occurredOn: string
        description: string
      }
    | undefined,
  currency: string | undefined
): TransactionCommonValues {
  return {
    valueCents: initialValueCents(draft?.amountMinor) ?? 0,
    currency: currency ?? draft?.currency ?? "",
    occurredOn: draft?.occurredOn ?? "",
    description: draft?.description ?? "",
  }
}
