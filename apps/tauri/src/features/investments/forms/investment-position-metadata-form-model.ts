import { z } from "zod"

export const investmentPositionMetadataSchema = z.object({
  label: z
    .string()
    .trim()
    .max(120, "O rótulo pode ter no máximo 120 caracteres."),
})

export function positionMetadataErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined

  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "Esta posição foi alterada. Atualize os dados e tente novamente."
    case "ENTITY_NOT_FOUND":
      return "A posição ou o livro não está mais disponível."
    default:
      return "Não foi possível salvar o rótulo da posição. Tente novamente."
  }
}
