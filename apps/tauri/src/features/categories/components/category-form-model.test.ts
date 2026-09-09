import { describe, expect, it } from "vitest"
import {
  categoryErrorMessage,
  categoryFormDefaults,
  categoryFormSchema,
} from "./category-form-model"

describe("category form model", () => {
  it("defines the requested creation defaults", () => {
    expect(categoryFormDefaults).toEqual({
      name: "",
      kind: "EXPENSE",
      iconKey: "label-dollar",
      colorHex: "f43f5e",
    })
  })

  it("trims names and lowercases a valid color", () => {
    expect(
      categoryFormSchema.parse({
        name: "  Mercado  ",
        kind: "EXPENSE",
        iconKey: "label-dollar",
        colorHex: "ABCDEF",
      })
    ).toEqual({
      name: "Mercado",
      kind: "EXPENSE",
      iconKey: "label-dollar",
      colorHex: "abcdef",
    })
  })

  it("rejects an empty name", () => {
    expect(() =>
      categoryFormSchema.parse({
        ...categoryFormDefaults,
        name: "   ",
      })
    ).toThrow("Informe um nome para a categoria.")
  })

  it("rejects an invalid category kind", () => {
    expect(() =>
      categoryFormSchema.parse({
        ...categoryFormDefaults,
        kind: "TRANSFER",
      })
    ).toThrow("Escolha Receita ou Despesa.")
  })

  it("rejects an empty or non-slug icon key", () => {
    for (const iconKey of [
      "",
      "Label Dollar",
      "label_dollar",
      "Label-Dollar",
    ]) {
      expect(() =>
        categoryFormSchema.parse({ ...categoryFormDefaults, iconKey })
      ).toThrow("Escolha um ícone válido.")
    }
  })

  it("rejects every non-canonical manual color format", () => {
    for (const colorHex of ["#abcdef", "abc", "abcdefgh", "abcd-gh", ""]) {
      expect(() =>
        categoryFormSchema.parse({ ...categoryFormDefaults, colorHex })
      ).toThrow("Informe uma cor hexadecimal opaca de seis dígitos.")
    }
  })

  it("maps known errors to safe create and edit actions", () => {
    expect(categoryErrorMessage({ code: "DUPLICATE_ENTITY" }, "criar")).toBe(
      "Já existe uma categoria com esse nome e tipo."
    )
    expect(
      categoryErrorMessage({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" }, "editar")
    ).toBe(
      "Esta categoria foi alterada. Atualize os dados antes de tentar novamente."
    )
    expect(
      categoryErrorMessage({ message: "/private/vault.sqlite" }, "editar")
    ).toBe("Não foi possível editar a categoria. Tente novamente.")
  })

  it("translates protected and missing category errors without internals", () => {
    expect(
      categoryErrorMessage({ code: "SYSTEM_ACCOUNT_PROTECTED" }, "editar")
    ).toBe("Categorias do sistema não podem ser alteradas.")
    expect(categoryErrorMessage({ code: "ENTITY_NOT_FOUND" }, "criar")).toBe(
      "A categoria ou livro não está mais disponível."
    )
  })
})
