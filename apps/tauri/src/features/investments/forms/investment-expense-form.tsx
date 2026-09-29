import type {
  FeeOrTaxDraft,
  InvestmentMutationResult,
  InvestmentPositionView,
} from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatMinorAmount } from "@workspace/ui/money"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledSelect } from "../../../components/forms/controlled-select"
import { ControlledToggleGroup } from "../../../components/forms/controlled-toggle-group"
import { useActiveBook, useMyFin } from "../../../providers"
import { useExpenseCategories } from "../../categories/hooks/use-expense-categories"
import { useInvestmentAccounts } from "../hooks"
import { useInvestmentSubmission } from "../hooks/use-investment-submission"
import {
  buildExpenseDraft,
  expenseErrorMessage,
  expenseFormDefaults,
  expenseFormSchema,
  type ExpenseFormValues,
} from "./investment-expense-form-model"
import {
  expenseCorrectionDefaults,
  type InvestmentAmendment,
  correctionErrorMessage,
} from "./investment-correction-form-model"

type Props = {
  readonly position: InvestmentPositionView
  readonly initialType?: "FEE" | "TAX"
  readonly amendment?: InvestmentAmendment
  readonly onSuccess?: (result: InvestmentMutationResult) => void
  readonly onCancel?: () => void
}

export function InvestmentExpenseForm({
  position,
  initialType = "FEE",
  amendment,
  onSuccess,
  onCancel,
}: Props) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const wallets = useInvestmentAccounts()
  const expenses = useExpenseCategories()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues:
      amendment === undefined
        ? { ...expenseFormDefaults, type: initialType }
        : expenseCorrectionDefaults(amendment.operation),
  })
  const values = useWatch({ control: form.control }) as ExpenseFormValues
  const wallet = wallets.data?.find(
    (account) => account.id === position.investmentAccountId
  )
  const expenseCategories = expenses.data ?? []
  const intentKey = [
    bookId ?? "none",
    position.id,
    position.version,
    amendment?.operation.id ?? "new",
    amendment?.operation.version ?? "new",
    amendment?.reason ?? "",
    JSON.stringify(values),
  ].join(":")
  const expense = useInvestmentSubmission<FeeOrTaxDraft>({
    intentKey,
    execute: ({ bookId: activeBookId, requestId, draft }) =>
      amendment === undefined
        ? services.investments.operations.expense.execute({
            ...draft,
            bookId: activeBookId,
            requestId,
          })
        : services.investments.operations.amend.execute({
            bookId: activeBookId,
            requestId,
            operationId: amendment.operation.id,
            expectedOperationVersion: amendment.operation.version,
            expectedPositionVersion: position.version,
            reason: amendment.reason,
            replacement: {
              ...draft,
              type: amendment.operation.type as FeeOrTaxDraft["type"],
              bookId: activeBookId,
              requestId,
            },
          }),
  })
  const pending = form.formState.isSubmitting || expense.isPending
  const draftResult =
    bookId === null
      ? null
      : buildExpenseDraft({
          values,
          position,
          bookId,
          requestId: expense.requestId,
          expenseCategoryIds: expenseCategories.map((category) => category.id),
        })
  const draft = draftResult?.ok ? draftResult.draft : null
  const previewQuery = useQuery({
    queryKey: [
      "investments",
      bookId,
      "expense-preview",
      draft,
      amendment?.operation.id,
      amendment?.operation.version,
    ],
    queryFn: () =>
      draft === null
        ? Promise.reject(new Error("Prévia indisponível"))
        : services.investments.operations.preview.execute({
            bookId: draft.bookId,
            draft,
            ...(amendment === undefined
              ? {}
              : {
                  amendment: {
                    operationId: amendment.operation.id,
                    expectedOperationVersion: amendment.operation.version,
                  },
                }),
          }),
    enabled: draft !== null,
    retry: false,
  })
  const preview = previewQuery.data?.ok ? previewQuery.data.value : null
  const previewError =
    previewQuery.data && !previewQuery.data.ok ? previewQuery.data.error : null

  function accountName(accountId: string): string {
    if (accountId === wallet?.id) return wallet.name
    return (
      expenseCategories.find((category) => category.id === accountId)?.name ??
      accountId
    )
  }

  const submit = form.handleSubmit(async (formValues) => {
    setFailure(null)
    if (bookId === null) return
    const validated = buildExpenseDraft({
      values: formValues,
      position,
      bookId,
      requestId: expense.requestId,
      expenseCategoryIds: expenseCategories.map((category) => category.id),
    })
    if (!validated.ok) {
      form.setError(validated.field, { message: validated.message })
      return
    }
    try {
      const result = await expense.submit(validated.draft)
      onSuccess?.(result)
    } catch (error) {
      const message =
        amendment === undefined
          ? expenseErrorMessage(error)
          : correctionErrorMessage(error)
      setFailure(message)
      toast.add({
        type: "error",
        title: "Não foi possível salvar a despesa",
        description: message,
      })
    }
  })

  if (bookId === null)
    return (
      <Alert>
        <AlertTitle>Selecione um livro para operar investimentos</AlertTitle>
        <AlertDescription>
          O formulário será liberado quando houver um livro ativo.
        </AlertDescription>
      </Alert>
    )

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup>
        <ControlledToggleGroup
          control={form.control}
          name="type"
          label="Tipo de despesa"
          disabled={pending || amendment !== undefined}
          options={[
            { value: "FEE", label: "Taxa" },
            { value: "TAX", label: "Imposto" },
          ]}
        />
        <ControlledInput
          control={form.control}
          name="amountDisplay"
          label="Valor pago"
          disabled={pending}
        />
        <ControlledSelect
          control={form.control}
          name="expenseCategoryId"
          label="Categoria de despesa"
          disabled={pending}
          options={expenseCategories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
        />
        <ControlledInput
          control={form.control}
          name="occurredOn"
          label="Data da operação"
          type="date"
          disabled={pending}
        />
        <ControlledInput
          control={form.control}
          name="description"
          label="Descrição"
          disabled={pending}
        />
      </FieldGroup>
      <Card size="sm" aria-label="Prévia da operação">
        <CardHeader>
          <CardTitle>Prévia da despesa</CardTitle>
          <CardDescription>
            Despesa independente vinculada à posição {position.instrumentName}.
            Use este registro para pagamento posterior, não para uma parcela já
            incluída em outra operação.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2" aria-live="polite">
          {draft === null && (
            <p>Preencha os dados da despesa para calcular a prévia.</p>
          )}
          {previewQuery.isFetching && <p>Calculando prévia...</p>}
          {(previewError || previewQuery.isError) && (
            <Alert variant="destructive">
              <AlertTitle>Prévia indisponível</AlertTitle>
              <AlertDescription>
                {previewError
                  ? expenseErrorMessage(previewError)
                  : "Não foi possível calcular a prévia. Tente novamente."}
              </AlertDescription>
            </Alert>
          )}
          {preview && (
            <>
              <p>
                Custo:{" "}
                {formatMinorAmount(
                  preview.bookCostDeltaMinor,
                  position.currency
                )}
              </p>
              <p>
                Fluxo líquido:{" "}
                {formatMinorAmount(preview.netCashFlowMinor, position.currency)}
              </p>
              <p>
                Caixa da carteira:{" "}
                {formatMinorAmount(
                  preview.projectedCashMinor,
                  position.currency
                )}
              </p>
              {preview.postings.length > 0 && (
                <div>
                  <p>Efeito em contas:</p>
                  <ul className="list-inside list-disc">
                    {preview.postings.map((posting, index) => (
                      <li key={posting.accountId + ":" + index}>
                        {accountName(posting.accountId)}:{" "}
                        {formatMinorAmount(
                          posting.amountMinor,
                          position.currency
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.categories.feeCategoryId && (
                <p>
                  Categoria de despesa:{" "}
                  {accountName(preview.categories.feeCategoryId)}
                </p>
              )}
              {preview.categories.taxCategoryId && (
                <p>
                  Categoria de despesa:{" "}
                  {accountName(preview.categories.taxCategoryId)}
                </p>
              )}
              {preview.warnings.some(
                (warning) => warning.code === "INVESTMENT_CASH_NEGATIVE"
              ) && (
                <Alert>
                  <AlertTitle>Possível caixa negativo</AlertTitle>
                  <AlertDescription>
                    O registro pode ser salvo com aviso; complete o ledger
                    quando necessário.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {Object.values(form.formState.errors).length > 0 && (
        <Alert>
          <AlertTitle>Revise os campos</AlertTitle>
          <AlertDescription>
            {Object.values(form.formState.errors).map((issue, index) => (
              <p key={index}>{String(issue?.message ?? "")}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {failure && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
          Registrar despesa
        </Button>
      </div>
    </form>
  )
}
