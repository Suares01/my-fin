import type {
  AmortizationDraft,
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
import { useActiveBook, useMyFin } from "../../../providers"
import { useExpenseCategories } from "../../categories/hooks/use-expense-categories"
import { useIncomeCategories } from "../../categories/hooks/use-income-categories"
import { useInvestmentAccounts } from "../hooks"
import { useInvestmentSubmission } from "../hooks/use-investment-submission"
import {
  amortizationErrorMessage,
  amortizationFormDefaults,
  amortizationFormSchema,
  amortizationGrossResult,
  buildAmortizationDraft,
  type AmortizationFormValues,
} from "./investment-amortization-form-model"

type Props = {
  readonly position: InvestmentPositionView
  readonly onSuccess?: (result: InvestmentMutationResult) => void
  readonly onCancel?: () => void
}

export function InvestmentAmortizationForm({
  position,
  onSuccess,
  onCancel,
}: Props) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const wallets = useInvestmentAccounts()
  const expenses = useExpenseCategories()
  const incomes = useIncomeCategories()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<AmortizationFormValues>({
    resolver: zodResolver(amortizationFormSchema),
    defaultValues: amortizationFormDefaults,
  })
  const values = useWatch({ control: form.control }) as AmortizationFormValues
  const wallet = wallets.data?.find(
    (account) => account.id === position.investmentAccountId
  )
  const expenseCategories = expenses.data ?? []
  const incomeCategories = incomes.data ?? []
  const intentKey = [
    bookId ?? "none",
    position.id,
    position.version,
    JSON.stringify(values),
  ].join(":")
  const amortization = useInvestmentSubmission<AmortizationDraft>({
    intentKey,
    execute: ({ bookId: activeBookId, requestId, draft }) =>
      services.investments.operations.amortization.execute({
        ...draft,
        bookId: activeBookId,
        requestId,
      }),
  })
  const pending = form.formState.isSubmitting || amortization.isPending
  const draftResult =
    bookId === null
      ? null
      : buildAmortizationDraft({
          values,
          position,
          bookId,
          requestId: amortization.requestId,
          incomeCategoryIds: incomeCategories.map((category) => category.id),
          expenseCategoryIds: expenseCategories.map((category) => category.id),
        })
  const draft = draftResult?.ok ? draftResult.draft : null
  const grossResult = amortizationGrossResult(values)
  const previewQuery = useQuery({
    queryKey: ["investments", bookId, "amortization-preview", draft],
    queryFn: () =>
      draft === null
        ? Promise.reject(new Error("Prévia indisponível"))
        : services.investments.operations.preview.execute({
            bookId: draft.bookId,
            draft,
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
      incomeCategories.find((category) => category.id === accountId)?.name ??
      expenseCategories.find((category) => category.id === accountId)?.name ??
      accountId
    )
  }

  const submit = form.handleSubmit(async (formValues) => {
    setFailure(null)
    if (bookId === null) return
    const validated = buildAmortizationDraft({
      values: formValues,
      position,
      bookId,
      requestId: amortization.requestId,
      incomeCategoryIds: incomeCategories.map((category) => category.id),
      expenseCategoryIds: expenseCategories.map((category) => category.id),
    })
    if (!validated.ok) {
      form.setError(validated.field, { message: validated.message })
      return
    }
    try {
      const result = await amortization.submit(validated.draft)
      onSuccess?.(result)
    } catch (error) {
      const message = amortizationErrorMessage(error)
      setFailure(message)
      toast.add({
        type: "error",
        title: "Não foi possível salvar a amortização",
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
        <ControlledInput
          control={form.control}
          name="costDisplay"
          label="Custo reduzido"
          disabled={pending}
        />
        <ControlledInput
          control={form.control}
          name="grossDisplay"
          label="Valor bruto recebido"
          disabled={pending}
        />
        {grossResult !== null && grossResult > 0n && (
          <ControlledSelect
            control={form.control}
            name="gainCategoryId"
            label="Categoria de ganho"
            disabled={pending}
            options={incomeCategories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        )}
        {grossResult !== null && grossResult < 0n && (
          <ControlledSelect
            control={form.control}
            name="lossCategoryId"
            label="Categoria de perda"
            disabled={pending}
            options={expenseCategories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        )}
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <ControlledInput
            control={form.control}
            name="feesDisplay"
            label="Taxas"
            disabled={pending}
          />
          <ControlledInput
            control={form.control}
            name="taxesDisplay"
            label="Impostos"
            disabled={pending}
          />
        </FieldGroup>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {values.feesDisplay !== "0" && (
            <ControlledSelect
              control={form.control}
              name="feeCategoryId"
              label="Categoria de taxas"
              disabled={pending}
              options={expenseCategories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          )}
          {values.taxesDisplay !== "0" && (
            <ControlledSelect
              control={form.control}
              name="taxCategoryId"
              label="Categoria de impostos"
              disabled={pending}
              options={expenseCategories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          )}
        </FieldGroup>
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
          <CardTitle>Prévia da amortização</CardTitle>
          <CardDescription>
            O custo é reduzido sem alterar unidades. Resultado bruto e despesas
            são parcelas da mesma operação.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2" aria-live="polite">
          {draft === null && (
            <p>Preencha os dados da amortização para calcular a prévia.</p>
          )}
          {previewQuery.isFetching && <p>Calculando prévia...</p>}
          {(previewError || previewQuery.isError) && (
            <Alert variant="destructive">
              <AlertTitle>Prévia indisponível</AlertTitle>
              <AlertDescription>
                {previewError
                  ? amortizationErrorMessage(previewError)
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
                Custo após:{" "}
                {formatMinorAmount(
                  (
                    BigInt(position.bookCostMinor) +
                    BigInt(preview.bookCostDeltaMinor)
                  ).toString(),
                  position.currency
                )}
              </p>
              {grossResult !== null && (
                <p>
                  Resultado bruto:{" "}
                  {formatMinorAmount(grossResult.toString(), position.currency)}
                </p>
              )}
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
              {preview.categories.gainCategoryId && (
                <p>
                  Categoria de ganho:{" "}
                  {accountName(preview.categories.gainCategoryId)}
                </p>
              )}
              {preview.categories.lossCategoryId && (
                <p>
                  Categoria de perda:{" "}
                  {accountName(preview.categories.lossCategoryId)}
                </p>
              )}
              {preview.categories.feeCategoryId && (
                <p>
                  Categoria de taxas:{" "}
                  {accountName(preview.categories.feeCategoryId)}
                </p>
              )}
              {preview.categories.taxCategoryId && (
                <p>
                  Categoria de impostos:{" "}
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
          Registrar amortização
        </Button>
      </div>
    </form>
  )
}
