import { z } from "zod"

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome para a conta."),
  kind: z.enum(["ASSET", "LIABILITY"], {
    error: "Escolha Ativo ou Passivo.",
  }),
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
    default:
      return "Não foi possível criar a conta. Tente novamente."
  }
}
