import type { CreateCategoryCommand } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Controller, useForm } from "react-hook-form"
import { useState } from "react"
import type { z } from "zod"
import { useActiveBook } from "../../../providers"
import { useCreateExpenseCategory, useCreateIncomeCategory } from "../hooks"
import {
  categoryErrorMessage,
  createCategorySchema,
} from "./category-form-model"

type CreateCategoryFormValues = z.input<typeof createCategorySchema>

function fieldMessage(field: "name" | "kind", value: string): true | string {
  const schema =
    field === "name"
      ? createCategorySchema.shape.name
      : createCategorySchema.shape.kind
  const result = schema.safeParse(value)

  return result.success
    ? true
    : (result.error.issues[0]?.message ?? "Valor inválido.")
}

type CategoryFormProps = {
  readonly onSuccess?: (categoryId: string) => void
  readonly onCancel?: () => void
}

export function CategoryForm({ onSuccess, onCancel }: CategoryFormProps) {
  const { session } = useActiveBook()
  const createIncome = useCreateIncomeCategory()
  const createExpense = useCreateExpenseCategory()
  const [submitError, setSubmitError] = useState<unknown>(null)
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryFormValues>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { name: "", kind: "EXPENSE" },
  })

  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const pending =
    isSubmitting || createIncome.isPending || createExpense.isPending
  const onSubmit = handleSubmit(async (values) => {
    if (activeBookId === null) return

    const parsed = createCategorySchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === "name" || field === "kind") {
          setError(field, { type: "schema", message: issue.message })
        }
      }
      return
    }

    const command: CreateCategoryCommand = {
      bookId: activeBookId,
      name: parsed.data.name,
      kind: parsed.data.kind,
    }

    try {
      setSubmitError(null)
      const category =
        command.kind === "INCOME"
          ? await createIncome.mutateAsync(command)
          : await createExpense.mutateAsync(command)
      onSuccess?.(category.id)
    } catch (error) {
      setSubmitError(error)
    }
  })

  if (activeBookId === null) {
    return (
      <Alert>
        <AlertTitle>Selecione um livro antes de criar a categoria</AlertTitle>
        <AlertDescription>
          O formulário será liberado quando houver um livro ativo.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {submitError !== null && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível criar a categoria</AlertTitle>
          <AlertDescription>
            {categoryErrorMessage(submitError)}
          </AlertDescription>
        </Alert>
      )}

      <form
        className="flex w-full flex-col gap-6"
        onSubmit={onSubmit}
        aria-busy={pending}
      >
        <FieldGroup>
          <Field data-invalid={errors.name ? "true" : undefined}>
            <FieldLabel htmlFor="category-name">Nome da categoria</FieldLabel>
            <Input
              id="category-name"
              autoComplete="off"
              placeholder="Mercado, salário ou transporte"
              className="touch-target"
              aria-invalid={errors.name ? "true" : "false"}
              aria-describedby="category-name-description category-name-error"
              disabled={pending}
              {...register("name", {
                validate: (value) => fieldMessage("name", value),
              })}
            />
            <FieldDescription id="category-name-description">
              Escolha um nome claro para classificar seus lançamentos.
            </FieldDescription>
            <FieldError id="category-name-error">
              {errors.name?.message}
            </FieldError>
          </Field>

          <Field data-invalid={errors.kind ? "true" : undefined}>
            <FieldLabel id="category-kind-label">Tipo da categoria</FieldLabel>
            <Controller
              control={control}
              name="kind"
              rules={{ validate: (value) => fieldMessage("kind", value) }}
              render={({ field }) => (
                <ToggleGroup
                  aria-labelledby="category-kind-label"
                  aria-invalid={errors.kind ? "true" : "false"}
                  multiple={false}
                  value={field.value ? [field.value] : []}
                  onValueChange={(value) => field.onChange(value[0] ?? "")}
                  className="w-full sm:w-fit"
                  disabled={pending}
                >
                  <ToggleGroupItem
                    value="EXPENSE"
                    className="touch-target flex-1 sm:flex-none"
                  >
                    Despesa
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="INCOME"
                    className="touch-target flex-1 sm:flex-none"
                  >
                    Receita
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            />
            <FieldDescription>
              Use Receita para entradas e Despesa para saídas do seu livro.
            </FieldDescription>
            <FieldError id="category-kind-error">
              {errors.kind?.message}
            </FieldError>
          </Field>
        </FieldGroup>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              className="touch-target w-full sm:w-fit"
              disabled={pending}
              onClick={onCancel}
            >
              Cancelar
            </Button>
          )}
          <Button
            className="touch-target w-full sm:w-fit"
            type="submit"
            disabled={pending}
          >
            {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {pending ? "Criando categoria" : "Criar categoria"}
          </Button>
        </div>
      </form>
    </div>
  )
}
