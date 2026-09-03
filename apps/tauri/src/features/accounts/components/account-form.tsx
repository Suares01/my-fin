import type { CreateFinancialAccountCommand } from "@workspace/application"
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
import { useCreateAccount } from "../hooks"
import { accountErrorMessage, createAccountSchema } from "./account-form-model"

type CreateAccountFormValues = z.input<typeof createAccountSchema>

function fieldMessage(field: "name" | "kind", value: string): true | string {
  const schema =
    field === "name"
      ? createAccountSchema.shape.name
      : createAccountSchema.shape.kind
  const result = schema.safeParse(value)

  return result.success
    ? true
    : (result.error.issues[0]?.message ?? "Valor inválido.")
}

type AccountFormProps = {
  readonly onSuccess?: (accountId: string) => void
  readonly onCancel?: () => void
}

export function AccountForm({ onSuccess, onCancel }: AccountFormProps) {
  const { session } = useActiveBook()
  const mutation = useCreateAccount()
  const [submitError, setSubmitError] = useState<unknown>(null)
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountFormValues>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { name: "", kind: "ASSET" },
  })

  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const pending = isSubmitting || mutation.isPending
  const onSubmit = handleSubmit(async (values) => {
    if (activeBookId === null) return

    const parsed = createAccountSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === "name" || field === "kind") {
          setError(field, { type: "schema", message: issue.message })
        }
      }
      return
    }

    const command: CreateFinancialAccountCommand = {
      bookId: activeBookId,
      name: parsed.data.name,
      kind: parsed.data.kind,
    }

    try {
      setSubmitError(null)
      const account = await mutation.mutateAsync(command)
      onSuccess?.(account.id)
    } catch (error) {
      setSubmitError(error)
    }
  })

  if (activeBookId === null) {
    return (
      <Alert>
        <AlertTitle>Selecione um livro antes de criar a conta</AlertTitle>
        <AlertDescription>
          O formulário será liberado quando houver um livro ativo.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {(mutation.isError || submitError !== null) && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível criar a conta</AlertTitle>
          <AlertDescription>
            {accountErrorMessage(submitError ?? mutation.error)}
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
            <FieldLabel htmlFor="account-name">Nome da conta</FieldLabel>
            <Input
              id="account-name"
              autoComplete="off"
              placeholder="Carteira, banco ou cartão"
              className="touch-target"
              aria-invalid={errors.name ? "true" : "false"}
              aria-describedby="account-name-description account-name-error"
              disabled={pending}
              {...register("name", {
                validate: (value) => fieldMessage("name", value),
              })}
            />
            <FieldDescription id="account-name-description">
              Escolha um nome reconhecível para encontrar esta conta no extrato.
            </FieldDescription>
            <FieldError id="account-name-error">
              {errors.name?.message}
            </FieldError>
          </Field>

          <Field data-invalid={errors.kind ? "true" : undefined}>
            <FieldLabel id="account-kind-label">Tipo da conta</FieldLabel>
            <Controller
              control={control}
              name="kind"
              rules={{ validate: (value) => fieldMessage("kind", value) }}
              render={({ field }) => (
                <ToggleGroup
                  aria-labelledby="account-kind-label"
                  aria-invalid={errors.kind ? "true" : "false"}
                  multiple={false}
                  value={field.value ? [field.value] : []}
                  onValueChange={(value) => field.onChange(value[0] ?? "")}
                  className="w-full sm:w-fit"
                  disabled={pending}
                >
                  <ToggleGroupItem
                    value="ASSET"
                    className="touch-target flex-1 sm:flex-none"
                  >
                    Ativo
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="LIABILITY"
                    className="touch-target flex-1 sm:flex-none"
                  >
                    Passivo
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            />
            <FieldDescription>
              Use Ativo para recursos e Passivo para valores que você deve.
            </FieldDescription>
            <FieldError id="account-kind-error">
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
            {pending ? "Criando conta" : "Criar conta"}
          </Button>
        </div>
      </form>
    </div>
  )
}
