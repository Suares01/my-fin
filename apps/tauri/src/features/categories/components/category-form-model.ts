import { z } from "zod"

const iconKeySchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Escolha um ícone válido.")

const colorHexSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{6}$/,
    "Informe uma cor hexadecimal opaca de seis dígitos."
  )
  .transform((value) => value.toLowerCase())

const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome para a categoria.")
const categoryKindSchema = z.enum(["INCOME", "EXPENSE"], {
  error: "Escolha Receita ou Despesa.",
})

export const categoryFormSchema = z.object({
  name: categoryNameSchema,
  kind: categoryKindSchema,
  iconKey: iconKeySchema,
  colorHex: colorHexSchema,
})

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  kind: categoryKindSchema,
})

export const categoryFormDefaults = {
  name: "",
  kind: "EXPENSE",
  iconKey: "label-dollar",
  colorHex: "f43f5e",
} as const

export type CategoryFormAction = "criar" | "editar"

export function categoryErrorMessage(
  error: unknown,
  action: CategoryFormAction = "criar"
): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined

  switch (code) {
    case "DUPLICATE_ENTITY":
      return "Já existe uma categoria com esse nome e tipo."
    case "ENTITY_NOT_FOUND":
      return "A categoria ou livro não está mais disponível."
    case "INVALID_ACCOUNT_KIND":
      return "Escolha Receita ou Despesa."
    case "SYSTEM_ACCOUNT_PROTECTED":
      return "Categorias do sistema não podem ser alteradas."
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "Esta categoria foi alterada. Atualize os dados antes de tentar novamente."
    default:
      return `Não foi possível ${action} a categoria. Tente novamente.`
  }
}
