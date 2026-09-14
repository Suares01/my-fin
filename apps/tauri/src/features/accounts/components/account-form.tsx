import type { CreateFinancialAccountCommand } from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledToggleGroup } from "../../../components/forms/controlled-toggle-group"
import { useActiveBook } from "../../../providers"
import { useCreateAccount } from "../hooks"
import { accountErrorMessage, createAccountSchema } from "./account-form-model"

type CreateAccountFormInput = z.input<typeof createAccountSchema>
type CreateAccountFormOutput = z.output<typeof createAccountSchema>

type AccountFormProps = {
  readonly onSuccess?: (accountId: string) => void
  readonly onCancel?: () => void
}

export function AccountForm({ onSuccess, onCancel }: AccountFormProps) {
  const { session } = useActiveBook()
  const mutation = useCreateAccount()
  const form = useForm<
    CreateAccountFormInput,
    unknown,
    CreateAccountFormOutput
  >({
    resolver: zodResolver(createAccountSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "", type: "OTHER_ASSET" },
  })

  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const pending = form.formState.isSubmitting || mutation.isPending
  const onSubmit = form.handleSubmit(async (values) => {
    if (activeBookId === null) return

    const command: CreateFinancialAccountCommand = {
      bookId: activeBookId,
      name: values.name,
      type: values.type,
    }

    try {
      const account = await mutation.mutateAsync(command)
      onSuccess?.(account.id)
    } catch (error) {
      toast.add({
        type: "error",
        title: "Não foi possível criar a conta",
        description: accountErrorMessage(error),
      })
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
    <form
      className="flex w-full flex-col gap-6"
      noValidate
      onSubmit={onSubmit}
      aria-busy={pending}
    >
      <FieldGroup>
        <ControlledInput
          control={form.control}
          name="name"
          label="Nome da conta"
          description="Escolha um nome reconhecível para encontrar esta conta no extrato."
          placeholder="Carteira, banco ou cartão"
          autoComplete="off"
          disabled={pending}
        />
        <ControlledToggleGroup
          control={form.control}
          name="type"
          label="Tipo da conta"
          description="Use Ativo para recursos e Passivo para valores que você deve."
          disabled={pending}
          options={[
            { value: "OTHER_ASSET", label: "Ativo" },
            { value: "OTHER_LIABILITY", label: "Passivo" },
          ]}
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
          {pending ? "Criando conta" : "Criar conta"}
        </Button>
      </div>
    </form>
  )
}
