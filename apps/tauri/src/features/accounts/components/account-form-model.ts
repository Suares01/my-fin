import { z } from "zod"

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome para a conta."),
  type: z.enum(
    [
      "BANK_ACCOUNT",
      "PAYMENT_ACCOUNT",
      "INVESTMENT_ACCOUNT",
      "CASH",
      "OTHER_ASSET",
      "CREDIT_CARD",
      "OTHER_LIABILITY",
    ],
    { error: "Escolha Ativo ou Passivo." }
  ),
  institutionName: z.string().trim(),
  displayReference: z.string().trim(),
  defaultSettlementAccountId: z.string().trim(),
})

export function accountErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined

  switch (code) {
    case "DUPLICATE_ENTITY":
      return "Já existe uma conta com esse nome e tipo."
    case "ENTITY_NOT_FOUND":
      return "O livro ativo não está mais disponível."
    case "INVALID_ACCOUNT_KIND":
      return "Escolha Ativo ou Passivo."
    case "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED":
      return "Esta classificação não pode ser alterada enquanto a conta estiver em uso."
    case "INVALID_SETTLEMENT_ACCOUNT":
      return "Escolha uma conta bancária ou de pagamento ativa deste livro para liquidação."
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "Esta conta foi alterada. Atualize a lista e tente novamente."
    default:
      return "Não foi possível criar a conta. Tente novamente."
  }
}
