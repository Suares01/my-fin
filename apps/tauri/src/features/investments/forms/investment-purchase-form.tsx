import type {
  InvestmentMutationResult,
  InvestmentPositionView,
  PurchaseOrApplicationDraft,
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
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledSelect } from "../../../components/forms/controlled-select"
import { ControlledToggleGroup } from "../../../components/forms/controlled-toggle-group"
import { useActiveBook, useMyFin } from "../../../providers"
import { useAccountBalances } from "../../accounts/hooks"
import { useExpenseCategories } from "../../categories/hooks/use-expense-categories"
import { useInvestmentAccounts } from "../hooks"
import { useInvestmentSubmission } from "../hooks/use-investment-submission"
import {
  buildPurchaseDraft,
  purchaseErrorMessage,
  purchaseFormDefaults,
  purchaseFormSchema,
  type PurchaseFormValues,
} from "./investment-purchase-form-model"
import {
  purchaseCorrectionDefaults,
  type InvestmentAmendment,
  correctionErrorMessage,
} from "./investment-correction-form-model"

type Props = {
  readonly position: InvestmentPositionView
  readonly amendment?: InvestmentAmendment
  readonly onSuccess?: (result: InvestmentMutationResult) => void
  readonly onCancel?: () => void
}

export function InvestmentPurchaseForm({
  position,
  amendment,
  onSuccess,
  onCancel,
}: Props) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const wallets = useInvestmentAccounts()
  const balances = useAccountBalances()
  const categories = useExpenseCategories()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues:
      amendment === undefined
        ? purchaseFormDefaults
        : purchaseCorrectionDefaults(amendment.operation),
  })
  const values = useWatch({ control: form.control }) as PurchaseFormValues
  const wallet = wallets.data?.find(
    (account) => account.id === position.investmentAccountId
  )
  const externalAccounts = useMemo(
    () =>
      balances.data?.filter(
        (account) =>
          !account.archived &&
          account.accountKind === "ASSET" &&
          account.financialAccount !== undefined &&
          ["BANK_ACCOUNT", "PAYMENT_ACCOUNT", "CASH"].includes(
            account.financialAccount.type
          ) &&
          account.currency === position.currency
      ) ?? [],
    [balances.data, position.currency]
  )
  const expenseCategories = categories.data ?? []
  const intentKey = `${bookId ?? "none"}:${position.id}:${position.version}:${amendment?.operation.id ?? "new"}:${amendment?.operation.version ?? "new"}:${amendment?.reason ?? ""}:${JSON.stringify(values)}`
  const purchase = useInvestmentSubmission<PurchaseOrApplicationDraft>({
    intentKey,
    execute: ({ bookId: activeBookId, requestId, draft }) =>
      amendment === undefined
        ? services.investments.operations.purchase.execute({
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
              type: amendment.operation
                .type as PurchaseOrApplicationDraft["type"],
              bookId: activeBookId,
              requestId,
            },
          }),
  })
  const pending = form.formState.isSubmitting || purchase.isPending

  useEffect(() => {
    if (
      values.fundingMode !== "EXTERNAL_ACCOUNT" ||
      values.externalAccountId ||
      !wallet?.defaultSettlementAccountId
    )
      return
    if (
      externalAccounts.some(
        (account) => account.accountId === wallet.defaultSettlementAccountId
      )
    )
      form.setValue("externalAccountId", wallet.defaultSettlementAccountId)
  }, [
    externalAccounts,
    form,
    values.fundingMode,
    values.externalAccountId,
    wallet?.defaultSettlementAccountId,
  ])

  const draftResult =
    bookId === null
      ? null
      : buildPurchaseDraft({
          values,
          position,
          bookId,
          requestId: purchase.requestId,
          externalAccountIds: externalAccounts.map(
            (account) => account.accountId
          ),
          expenseCategoryIds: expenseCategories.map((category) => category.id),
        })
  const draft = draftResult?.ok ? draftResult.draft : null
  const previewQuery = useQuery({
    queryKey: [
      "investments",
      bookId,
      "purchase-preview",
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
    enabled: draft !== null && position.status === "OPEN",
    retry: false,
  })
  const preview = previewQuery.data?.ok ? previewQuery.data.value : null
  const previewError =
    previewQuery.data && !previewQuery.data.ok ? previewQuery.data.error : null
  const action = position.assetClass === "FIXED_INCOME" ? "Aplicar" : "Comprar"

  const submit = form.handleSubmit(async (formValues) => {
    setFailure(null)
    if (bookId === null || position.status !== "OPEN") return
    const validated = buildPurchaseDraft({
      values: formValues,
      position,
      bookId,
      requestId: purchase.requestId,
      externalAccountIds: externalAccounts.map((account) => account.accountId),
      expenseCategoryIds: expenseCategories.map((category) => category.id),
    })
    if (!validated.ok) {
      form.setError(validated.field, { message: validated.message })
      return
    }
    try {
      const result = await purchase.submit(validated.draft)
      onSuccess?.(result)
    } catch (error) {
      const message =
        amendment === undefined
          ? purchaseErrorMessage(error)
          : correctionErrorMessage(error)
      setFailure(message)
      toast.add({
        type: "error",
        title: "Não foi possível salvar a operação",
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
  if (position.status !== "OPEN")
    return (
      <Alert>
        <AlertTitle>Posição encerrada</AlertTitle>
        <AlertDescription>
          Atualize a posição antes de registrar uma compra ou aplicação.
        </AlertDescription>
      </Alert>
    )

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup>
        <ControlledToggleGroup
          control={form.control}
          name="fundingMode"
          label="Origem do dinheiro"
          disabled={pending}
          options={[
            { value: "INTERNAL_CASH", label: "Caixa da carteira" },
            { value: "EXTERNAL_ACCOUNT", label: "Conta externa" },
          ]}
        />
        {values.fundingMode === "EXTERNAL_ACCOUNT" && (
          <ControlledSelect
            control={form.control}
            name="externalAccountId"
            label="Conta de origem"
            disabled={pending}
            options={externalAccounts.map((account) => ({
              value: account.accountId,
              label: account.accountName,
            }))}
          />
        )}
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <ControlledInput
            control={form.control}
            name="capitalDisplay"
            label="Principal"
            disabled={pending}
          />
          {position.quantity !== undefined && (
            <ControlledInput
              control={form.control}
              name="quantity"
              label="Quantidade"
              disabled={pending}
            />
          )}
        </FieldGroup>
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
          <CardTitle>Prévia da operação</CardTitle>
          <CardDescription>
            O saldo e a versão da posição são conferidos novamente ao salvar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2" aria-live="polite">
          {draft === null && (
            <p>Preencha os dados da operação para calcular a prévia.</p>
          )}
          {previewQuery.isFetching && <p>Calculando prévia...</p>}
          {(previewError || previewQuery.isError) && (
            <Alert variant="destructive">
              <AlertTitle>Prévia indisponível</AlertTitle>
              <AlertDescription>
                {previewError
                  ? purchaseErrorMessage(previewError)
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
                      <li key={`${posting.accountId}:${index}`}>
                        {posting.accountId === wallet?.id
                          ? wallet.name
                          : (externalAccounts.find(
                              (account) =>
                                account.accountId === posting.accountId
                            )?.accountName ?? posting.accountId)}
                        :{" "}
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
                  Categoria de taxas:{" "}
                  {expenseCategories.find(
                    (category) =>
                      category.id === preview.categories.feeCategoryId
                  )?.name ?? preview.categories.feeCategoryId}
                </p>
              )}
              {preview.categories.taxCategoryId && (
                <p>
                  Categoria de impostos:{" "}
                  {expenseCategories.find(
                    (category) =>
                      category.id === preview.categories.taxCategoryId
                  )?.name ?? preview.categories.taxCategoryId}
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
          {action}
        </Button>
      </div>
    </form>
  )
}
