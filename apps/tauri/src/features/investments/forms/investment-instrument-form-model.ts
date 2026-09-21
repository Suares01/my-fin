import { z } from "zod"

export const investmentInstrumentSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do instrumento."),
  type: z.string().trim().min(1, "Escolha o tipo do instrumento."),
  issuerName: z.string().trim(),
  identifiers: z.array(
    z.object({
      scheme: z.string().trim(),
      value: z.string().trim(),
      market: z.string().trim(),
    })
  ),
})

export function instrumentErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined

  switch (code) {
    case "DUPLICATE_INSTRUMENT_IDENTIFIER":
      return "Este identificador já está em uso neste livro."
    case "INVESTMENT_INSTRUMENT_TYPE_IMMUTABLE":
      return "O tipo e a moeda não podem mudar depois da primeira posição."
    case "INVESTMENT_INSTRUMENT_IN_USE":
      return "Feche as posições abertas antes de arquivar este instrumento."
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "Este instrumento foi alterado. Atualize a lista e tente novamente."
    case "INVESTMENT_CURRENCY_MISMATCH":
      return "A moeda do instrumento deve ser a moeda-base do livro."
    case "ENTITY_NOT_FOUND":
      return "O livro ou instrumento não está mais disponível."
    default:
      return "Não foi possível salvar o instrumento. Tente novamente."
  }
}
