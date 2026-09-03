import { z } from "zod"

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Informe um nome para a categoria."),
  kind: z.enum(["INCOME", "EXPENSE"], {
    error: "Escolha Receita ou Despesa.",
  }),
})

export function categoryErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined

  switch (code) {
    case "DUPLICATE_ENTITY":
      return "Já existe uma categoria com esse nome e tipo."
    case "ENTITY_NOT_FOUND":
      return "O livro ativo não está mais disponível."
    case "INVALID_ACCOUNT_KIND":
      return "Escolha Receita ou Despesa."
    default:
      return "Não foi possível criar a categoria. Tente novamente."
  }
}
