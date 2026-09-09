import type {
  CategorySummary,
  CreateCategoryCommand,
  UpdateCategoryCommand,
} from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import type { z } from "zod"
import { toast } from "@workspace/ui/components/toast"
import { ControlledColorPicker } from "../../../components/forms/controlled-color-picker"
import { ControlledField } from "../../../components/forms/controlled-field"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { useActiveBook } from "../../../providers"
import {
  useCreateExpenseCategory,
  useCreateIncomeCategory,
  useUpdateCategory,
} from "../hooks"
import { CategoryIconField } from "./category-icon-field"
import {
  categoryErrorMessage,
  categoryFormDefaults,
  categoryFormSchema,
  type CategoryFormAction,
} from "./category-form-model"

type CategoryFormInput = z.input<typeof categoryFormSchema>
type CategoryFormOutput = z.output<typeof categoryFormSchema>

type CategoryFormProps = {
  readonly mode?: "create" | "edit"
  readonly initialCategory?: CategorySummary
  readonly onSuccess?: (categoryId: string) => void
  readonly onCancel?: () => void
}

function categoryFormValues(
  mode: "create" | "edit",
  initialCategory?: CategorySummary
): CategoryFormInput {
  if (mode === "edit" && initialCategory !== undefined) {
    return {
      name: initialCategory.name,
      kind: initialCategory.kind,
      iconKey: initialCategory.iconKey,
      colorHex: initialCategory.colorHex,
    }
  }

  return { ...categoryFormDefaults }
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code ===
      "OPTIMISTIC_CONCURRENCY_FAILURE"
  )
}

export function CategoryForm({
  mode = "create",
  initialCategory,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const { session } = useActiveBook()
  const createIncome = useCreateIncomeCategory()
  const createExpense = useCreateExpenseCategory()
  const update = useUpdateCategory()
  const [conflictLocked, setConflictLocked] = useState(false)
  const defaultValues = categoryFormValues(mode, initialCategory)
  const form = useForm<CategoryFormInput, unknown, CategoryFormOutput>({
    resolver: zodResolver(categoryFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues,
  })
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = form

  useEffect(() => {
    reset(categoryFormValues(mode, initialCategory))
    // The form is reset when the page supplies a refreshed category after a conflict.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConflictLocked(false)
  }, [initialCategory, mode, reset])

  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const pending =
    isSubmitting ||
    createIncome.isPending ||
    createExpense.isPending ||
    update.isPending ||
    conflictLocked
  const action: CategoryFormAction = mode === "edit" ? "editar" : "criar"

  const onSubmit = handleSubmit(async (values) => {
    if (
      activeBookId === null ||
      conflictLocked ||
      (mode === "edit" && initialCategory === undefined)
    ) {
      return
    }

    try {
      const result =
        mode === "edit" && initialCategory !== undefined
          ? await update.mutateAsync({
              bookId: activeBookId,
              categoryId: initialCategory.id,
              expectedVersion: initialCategory.version,
              name: values.name,
              iconKey: values.iconKey,
              colorHex: values.colorHex,
            } satisfies UpdateCategoryCommand)
          : await (values.kind === "INCOME"
              ? createIncome.mutateAsync({
                  bookId: activeBookId,
                  name: values.name,
                  kind: values.kind,
                  iconKey: values.iconKey,
                  colorHex: values.colorHex,
                } satisfies CreateCategoryCommand)
              : createExpense.mutateAsync({
                  bookId: activeBookId,
                  name: values.name,
                  kind: values.kind,
                  iconKey: values.iconKey,
                  colorHex: values.colorHex,
                } satisfies CreateCategoryCommand))

      if (result.refreshWarning) {
        toast.add({
          type: "warning",
          title: "Categoria salva",
          description: "Atualize os dados para ver a lista mais recente.",
        })
      }
      onSuccess?.(result.value.id)
    } catch (error) {
      if (isConflict(error)) setConflictLocked(true)
      toast.add({
        type: "error",
        title: `Não foi possível ${action} a categoria`,
        description: categoryErrorMessage(error, action),
      })
    }
  })

  if (activeBookId === null) {
    return (
      <Alert>
        <AlertTitle>
          Selecione um livro antes de {action} a categoria
        </AlertTitle>
        <AlertDescription>
          O formulário será liberado quando houver um livro ativo.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form
      className="flex w-full flex-col gap-6"
      noValidate
      onSubmit={onSubmit}
      aria-busy={pending}
    >
      <FieldGroup>
        <ControlledInput
          control={control}
          name="name"
          label="Nome da categoria"
          description="Escolha um nome claro para classificar seus lançamentos."
          placeholder="Mercado, salário ou transporte"
          autoComplete="off"
          disabled={pending}
        />

        {mode === "create" ? (
          <Controller
            control={control}
            name="kind"
            render={({ field, fieldState }) => (
              <ControlledField
                id="category-kind"
                label="Tipo da categoria"
                description="Use Receita para entradas e Despesa para saídas do seu livro."
                error={fieldState.error}
                disabled={pending}
              >
                <ToggleGroup
                  id="category-kind"
                  aria-label="Tipo da categoria"
                  aria-invalid={fieldState.invalid}
                  multiple={false}
                  value={field.value ? [field.value] : []}
                  onValueChange={(value) => field.onChange(value[0] ?? "")}
                  onBlur={field.onBlur}
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
              </ControlledField>
            )}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Tipo da categoria</span>
            <Badge variant="outline">
              {initialCategory?.kind === "INCOME" ? "Receita" : "Despesa"}
            </Badge>
          </div>
        )}

        <CategoryIconField
          control={control}
          name="iconKey"
          label="Ícone da categoria"
          description="Escolha um ícone para reconhecer a categoria."
          disabled={pending}
        />
        <ControlledColorPicker
          control={control}
          name="colorHex"
          label="Cor da categoria"
          description="Use uma cor hexadecimal opaca de seis dígitos."
          disabled={pending}
        />
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
          {pending
            ? mode === "edit"
              ? "Salvando categoria"
              : "Criando categoria"
            : mode === "edit"
              ? "Salvar categoria"
              : "Criar categoria"}
        </Button>
      </div>
    </form>
  )
}
