import type {
  ConfigureFinancialAccountCommand,
  CreateFinancialAccountCommand,
} from "@workspace/application"
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
import { useForm, useWatch } from "react-hook-form"
import type { z } from "zod"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledSelect } from "../../../components/forms/controlled-select"
import { ControlledToggleGroup } from "../../../components/forms/controlled-toggle-group"
import { useActiveBook } from "../../../providers"
import { useConfigureAccount, useCreateAccount } from "../hooks"
import type { FinancialAccountBalance } from "./account-card"
import { accountErrorMessage, createAccountSchema } from "./account-form-model"

type CreateAccountFormInput = z.input<typeof createAccountSchema>
type CreateAccountFormOutput = z.output<typeof createAccountSchema>

type AccountFormProps = {
  readonly mode?: "create" | "edit"
  readonly initialAccount?: FinancialAccountBalance
  readonly settlementAccounts?: readonly {
    readonly id: string
    readonly name: string
  }[]
  readonly onSuccess?: (accountId: string) => void
  readonly onCancel?: () => void
}

const accountTypes = [
  { value: "BANK_ACCOUNT", label: "Banco" },
  { value: "PAYMENT_ACCOUNT", label: "Conta de pagamento" },
  { value: "INVESTMENT_ACCOUNT", label: "Investimento" },
  { value: "CASH", label: "Dinheiro" },
  { value: "OTHER_ASSET", label: "Ativo" },
  { value: "CREDIT_CARD", label: "Cartão de crédito" },
  { value: "OTHER_LIABILITY", label: "Passivo" },
] as const

function formValues(
  mode: "create" | "edit",
  initialAccount?: FinancialAccountBalance
): CreateAccountFormInput {
  if (mode === "edit" && initialAccount !== undefined) {
    return {
      name: initialAccount.accountName,
      type: (initialAccount.financialAccount?.type ??
        "OTHER_ASSET") as CreateAccountFormInput["type"],
      institutionName: initialAccount.financialAccount?.institutionName ?? "",
      displayReference: initialAccount.financialAccount?.displayReference ?? "",
      defaultSettlementAccountId:
        initialAccount.financialAccount?.defaultSettlementAccountId ?? "",
    }
  }

  return {
    name: "",
    type: "OTHER_ASSET",
    institutionName: "",
    displayReference: "",
    defaultSettlementAccountId: "",
  }
}

function optionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function AccountForm({
  mode = "create",
  initialAccount,
  settlementAccounts = [],
  onSuccess,
  onCancel,
}: AccountFormProps) {
  const { session } = useActiveBook()
  const create = useCreateAccount()
  const configure = useConfigureAccount()
  const form = useForm<
    CreateAccountFormInput,
    unknown,
    CreateAccountFormOutput
  >({
    resolver: zodResolver(createAccountSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: formValues(mode, initialAccount),
  })

  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const type = useWatch({ control: form.control, name: "type" })
  const isEdit = mode === "edit"
  const pending =
    form.formState.isSubmitting || create.isPending || configure.isPending
  const action = isEdit ? "salvar a classificação" : "criar a conta"
  const onSubmit = form.handleSubmit(async (values) => {
    if (activeBookId === null || (isEdit && initialAccount === undefined))
      return

    const profile = {
      type: values.type,
      ...(optionalValue(values.institutionName) === undefined
        ? {}
        : { institutionName: optionalValue(values.institutionName) }),
      ...(optionalValue(values.displayReference) === undefined
        ? {}
        : { displayReference: optionalValue(values.displayReference) }),
      ...(values.type !== "INVESTMENT_ACCOUNT" ||
      !values.defaultSettlementAccountId
        ? {}
        : { defaultSettlementAccountId: values.defaultSettlementAccountId }),
    }

    try {
      const account = isEdit
        ? await configure.mutateAsync({
            bookId: activeBookId,
            accountId: initialAccount!.accountId,
            expectedVersion: initialAccount!.version ?? 0,
            profile,
          } satisfies ConfigureFinancialAccountCommand)
        : await create.mutateAsync({
            bookId: activeBookId,
            name: values.name,
            ...profile,
          } satisfies CreateFinancialAccountCommand)
      onSuccess?.(account.id)
    } catch (error) {
      toast.add({
        type: "error",
        title: `Não foi possível ${action}`,
        description: accountErrorMessage(error),
      })
    }
  })

  if (activeBookId === null) {
    return (
      <Alert>
        <AlertTitle>Selecione um livro antes de {action}</AlertTitle>
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
        {!isEdit && (
          <ControlledInput
            control={form.control}
            name="name"
            label="Nome da conta"
            description="Escolha um nome reconhecível para encontrar esta conta no extrato."
            placeholder="Carteira, banco ou cartão"
            autoComplete="off"
            disabled={pending}
          />
        )}
        <ControlledToggleGroup
          control={form.control}
          name="type"
          label="Tipo da conta"
          description="Defina a finalidade da conta. Outro ativo fica fora do dinheiro disponível e não cria lançamentos."
          disabled={pending}
          options={accountTypes}
        />
        <ControlledInput
          control={form.control}
          name="institutionName"
          label="Instituição"
          description="Opcional. Informe o banco, corretora ou emissor quando ajudar a reconhecer a conta."
          placeholder="Banco ou corretora"
          autoComplete="organization"
          disabled={pending}
        />
        <ControlledInput
          control={form.control}
          name="displayReference"
          label="Referência"
          description="Opcional. Use um apelido, agência ou final da conta sem registrar credenciais."
          placeholder="Final 1234"
          autoComplete="off"
          disabled={pending}
        />
        {type === "INVESTMENT_ACCOUNT" && (
          <ControlledSelect
            control={form.control}
            name="defaultSettlementAccountId"
            label="Conta padrão de liquidação"
            description="Opcional. Apenas antecipa a conta em operações externas; cada operação continua exigindo escolha explícita."
            placeholder="Sem conta padrão"
            disabled={pending}
            options={settlementAccounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
          />
        )}
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
            ? isEdit
              ? "Salvando classificação"
              : "Criando conta"
            : isEdit
              ? "Salvar classificação"
              : "Criar conta"}
        </Button>
      </div>
    </form>
  )
}
