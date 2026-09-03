import { z } from "zod"

const nameSchema = z.string().trim().min(1, "Informe um nome para o livro.")
const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "Use exatamente três letras maiúsculas, como BRL.")
const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Informe um timezone IANA.")
  .refine(isValidTimezone, "Use um timezone IANA aceito pelo dispositivo.")

export const createBookSchema = z.object({
  name: nameSchema,
  baseCurrency: currencySchema,
  timezone: timezoneSchema,
})

export type CreateBookFormValues = z.input<typeof createBookSchema>

export function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone }).format()
    return true
  } catch {
    return false
  }
}
