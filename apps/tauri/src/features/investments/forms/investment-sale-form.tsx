import type {
  InvestmentMutationResult,
  InvestmentPositionView,
  SaleOrRedemptionDraft,
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
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledSelect } from "../../../components/forms/controlled-select"
import { ControlledToggleGroup } from "../../../components/forms/controlled-toggle-group"
import { useActiveBook, useMyFin } from "../../../providers"
import { useAccountBalances } from "../../accounts/hooks"
import { useExpenseCategories } from "../../categories/hooks/use-expense-categories"
import { useIncomeCategories } from "../../categories/hooks/use-income-categories"
import { useInvestmentAccounts } from "../hooks"
import { useInvestmentSubmission } from "../hooks/use-investment-submission"
import { parseOpeningMoney } from "./open-investment-position-form-model"
import {
  buildSaleDraft,
  minorToSaleInput,
  saleErrorMessage,
  saleFormDefaults,
  saleFormSchema,
  type SaleFormValues,
} from "./investment-sale-form-model"

type Props = {
  readonly position: InvestmentPositionView
  readonly onSuccess?: (result: InvestmentMutationResult) => void
  readonly onCancel?: () => void
}

export function InvestmentSaleForm({ position, onSuccess, onCancel }: Props) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const wallets = useInvestmentAccounts()
  const balances = useAccountBalances()
  const expenses = useExpenseCategories()
  const incomes = useIncomeCategories()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: saleFormDefaults,
  })
  const values = useWatch({ control: form.control }) as SaleFormValues
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
  const expenseCategories = expenses.data ?? []
  const incomeCategories = incomes.data ?? []
  const intentKey = [
    bookId ?? "none",
    position.id,
    position.version,
    JSON.stringify(values),
  ].join(":")
  const sale = useInvestmentSubmission<SaleOrRedemptionDraft>({
    intentKey,
    execute: ({ bookId: activeBookId, requestId, draft }) =>
      services.investments.operations.sale.execute({
        ...draft,
        bookId: activeBookId,
        requestId,
      }),
  })
  const pending = form.formState.isSubmitting || sale.isPending
  const priorScope = useRef(values.scope)

  useEffect(() => {
    if (priorScope.current === values.scope) return
    priorScope.current = values.scope
    form.setValue(
      "costDisplay",
      values.scope === "TOTAL" ? minorToSaleInput(position.bookCostMinor) : ""
    )
    if (position.quantity !== undefined)
      form.setValue(
        "quantity",
        values.scope === "TOTAL" ? position.quantity : ""
      )
  }, [form, position.bookCostMinor, position.quantity, values.scope])

  useEffect(() => {
    if (
      values.destinationMode !== "EXTERNAL_ACCOUNT" ||
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
    values.destinationMode,
    values.externalAccountId,
    wallet?.defaultSettlementAccountId,
  ])

  const visibleCost =
    values.scope === "TOTAL"
      ? position.bookCostMinor
      : parseOpeningMoney(values.costDisplay)
  const visibleGross = parseOpeningMoney(values.grossDisplay)
  const grossResult =
    visibleCost === null || visibleGross === null
      ? null
      : BigInt(visibleGross) - BigInt(visibleCost)
  const draftResult =
    bookId === null
      ? null
      : buildSaleDraft({
          values,
          position,
          bookId,
          requestId: sale.requestId,
          externalAccountIds: externalAccounts.map(
            (account) => account.accountId
          ),
          incomeCategoryIds: incomeCategories.map((category) => category.id),
          expenseCategoryIds: expenseCategories.map((category) => category.id),
        })
  const draft = draftResult?.ok ? draftResult.draft : null
  const previewQuery = useQuery({
    queryKey: ["investments", bookId, "sale-preview", draft],
    queryFn: () =>
      draft === null
        ? Promise.reject(new Error("Prévia indisponível"))
        : services.investments.operations.preview.execute({
            bookId: draft.bookId,
            draft,
          }),
    enabled: draft !== null && position.status === "OPEN",
    retry: false,
  })
  const preview = previewQuery.data?.ok ? previewQuery.data.value : null
  const previewError =
    previewQuery.data && !previewQuery.data.ok ? previewQuery.data.error : null
  const action = position.assetClass === "FIXED_INCOME" ? "Resgatar" : "Vender"

  function accountName(accountId: string): string {
    if (accountId === wallet?.id) return wallet.name
    return (
      externalAccounts.find((account) => account.accountId === accountId)
        ?.accountName ??
      incomeCategories.find((category) => category.id === accountId)?.name ??
      expenseCategories.find((category) => category.id === accountId)?.name ??
      accountId
    )
  }

  const submit = form.handleSubmit(async (formValues) => {
    setFailure(null)
    if (bookId === null || position.status !== "OPEN") return
    const validated = buildSaleDraft({
      values: formValues,
      position,
      bookId,
      requestId: sale.requestId,
      externalAccountIds: externalAccounts.map((account) => account.accountId),
      incomeCategoryIds: incomeCategories.map((category) => category.id),
      expenseCategoryIds: expenseCategories.map((category) => category.id),
    })
    if (!validated.ok) {
      form.setError(validated.field, { message: validated.message })
      return
    }
    try {
      const result = await sale.submit(validated.draft)
      onSuccess?.(result)
    } catch (error) {
      const message = saleErrorMessage(error)
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
          Atualize a posição antes de registrar uma venda ou resgate.
        </AlertDescription>
      </Alert>
    )

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup>
        <ControlledToggleGroup
          control={form.control}
          name="scope"
          label="Extensão da saída"
          disabled={pending}
          options={[
            { value: "PARTIAL", label: "Parcial" },
            { value: "TOTAL", label: "Total" },
          ]}
        />
        <ControlledToggleGroup
          control={form.control}
          name="destinationMode"
          label="Destino do dinheiro"
          disabled={pending}
          options={[
            { value: "INTERNAL_CASH", label: "Caixa da carteira" },
            { value: "EXTERNAL_ACCOUNT", label: "Conta externa" },
          ]}
        />
        {values.destinationMode === "EXTERNAL_ACCOUNT" && (
          <ControlledSelect
            control={form.control}
            name="externalAccountId"
            label="Conta de destino"
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
            name="costDisplay"
            label="Custo da parte vendida/resgatada"
            disabled={pending || values.scope === "TOTAL"}
          />
          {position.quantity !== undefined && (
            <ControlledInput
              control={form.control}
              name="quantity"
              label="Quantidade"
              disabled={pending || values.scope === "TOTAL"}
            />
          )}
        </FieldGroup>
        <ControlledInput
          control={form.control}
          name="grossDisplay"
          label="Valor bruto recebido"
          disabled={pending}
        />
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
            O custo retirado não é calculado por preço médio nem por política
            fiscal.
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
                  ? saleErrorMessage(previewError)
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
          {action}
        </Button>
      </div>
    </form>
  )
}
