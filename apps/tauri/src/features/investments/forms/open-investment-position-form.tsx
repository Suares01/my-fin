import type {
  InvestmentMutationResult,
  OpenInvestmentPositionCommand,
  OpenInvestmentPositionWithPurchaseCommand,
  PreviewInvestmentPositionOpeningCommand,
  SetInvestmentOpeningBalanceCommand,
} from "@workspace/application"
import { useQuery } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { formatMinorAmount } from "@workspace/ui/money"
import { toast } from "@workspace/ui/components/toast"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledSelect } from "../../../components/forms/controlled-select"
import { ControlledToggleGroup } from "../../../components/forms/controlled-toggle-group"
import { useActiveBook, useMyFin } from "../../../providers"
import { useAccountBalances } from "../../accounts/hooks"
import { AccountForm } from "../../accounts/components/account-form"
import { useBookDetail } from "../../books/hooks"
import { useInvestmentAccounts, useInvestmentInstruments } from "../hooks"
import { useInvestmentSubmission } from "../hooks/use-investment-submission"
import { InvestmentInstrumentForm } from "./investment-instrument-form"
import {
  openingErrorMessage,
  openingFormDefaults,
  openingFormSchema,
  parseOpeningMoney,
  parseOpeningQuantity,
  type OpeningFormValues,
} from "./open-investment-position-form-model"

type Props = {
  readonly onSuccess?: (result: InvestmentMutationResult) => void
  readonly onCancel?: () => void
}

const UNIT_REQUIRED_TYPES = new Set([
  "STOCK",
  "BDR",
  "ETF",
  "REAL_ESTATE_FUND",
  "MUTUAL_FUND",
  "CRYPTO_ASSET",
])

function optional(value: string): string | undefined {
  return value.trim() || undefined
}

function selectedTerms(values: OpeningFormValues) {
  const terms = {
    ...(values.rateKind ? { rateKind: values.rateKind } : {}),
    ...(values.index ? { index: values.index } : {}),
    ...(values.annualRate
      ? { annualRate: values.annualRate.replace(",", ".") }
      : {}),
    ...(values.indexPercentage
      ? { indexPercentage: values.indexPercentage.replace(",", ".") }
      : {}),
    ...(values.annualSpreadRate
      ? { annualSpreadRate: values.annualSpreadRate.replace(",", ".") }
      : {}),
    ...(values.issueDate ? { issueDate: values.issueDate } : {}),
    ...(values.gracePeriodDate
      ? { gracePeriodDate: values.gracePeriodDate }
      : {}),
    ...(values.maturityDate ? { maturityDate: values.maturityDate } : {}),
  }
  return Object.keys(terms).length > 0 ? terms : undefined
}

function validTerms(values: OpeningFormValues): string | null {
  if (
    values.rateKind === "PREFIXED" &&
    !/^\d+(?:[.,]\d+)?$/.test(values.annualRate)
  )
    return "Informe a taxa anual."
  if (
    (values.rateKind === "INDEXED" || values.rateKind === "HYBRID") &&
    (!values.index || !/^\d+(?:[.,]\d+)?$/.test(values.indexPercentage))
  )
    return "Informe índice e percentual."
  if (
    values.rateKind === "HYBRID" &&
    !/^\d+(?:[.,]\d+)?$/.test(values.annualSpreadRate)
  )
    return "Informe o spread anual."
  if (
    values.rateKind === "" &&
    (values.index ||
      values.annualRate ||
      values.indexPercentage ||
      values.annualSpreadRate)
  )
    return "Escolha o tipo de taxa."
  const dates = [
    values.issueDate,
    values.gracePeriodDate,
    values.maturityDate,
  ].filter(Boolean)
  if (
    dates.some(
      (date) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    )
  )
    return "Informe datas válidas."
  if (dates.some((date, index) => index > 0 && date < dates[index - 1]!))
    return "Informe os termos em ordem cronológica."
  return null
}

function openingPreviewCommand(input: {
  readonly values: OpeningFormValues
  readonly bookId: string | null
  readonly currency: string | undefined
  readonly walletId: string | undefined
  readonly instrumentId: string | undefined
  readonly fixedIncome: boolean
  readonly unitsRequired: boolean
  readonly confirmedBalance: boolean
  readonly externalAccountIds: readonly string[]
}): PreviewInvestmentPositionOpeningCommand | null {
  const {
    values,
    bookId,
    currency,
    walletId,
    instrumentId,
    fixedIncome,
    unitsRequired,
    confirmedBalance,
    externalAccountIds,
  } = input
  if (!bookId || !currency || !walletId || !instrumentId) return null
  if (unitsRequired && values.quantityMode !== "UNITS") return null
  const amount = parseOpeningMoney(values.costDisplay)
  if (
    amount === null ||
    (values.mode === "BUY" && amount === "0") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(values.occurredOn) ||
    (fixedIncome && validTerms(values) !== null)
  )
    return null
  const quantity =
    values.quantityMode === "UNITS"
      ? parseOpeningQuantity(values.quantity)
      : undefined
  if (quantity === null) return null
  const common = {
    bookId,
    investmentAccountId: walletId,
    instrumentId,
    quantityMode: values.quantityMode,
    occurredOn: values.occurredOn,
    ...(optional(values.label) ? { label: optional(values.label) } : {}),
    ...(fixedIncome && selectedTerms(values)
      ? { fixedIncomeTerms: selectedTerms(values) }
      : {}),
  } as const
  if (values.mode === "OWNED" && values.origin !== "EXTERNAL_ACCOUNT") {
    const initialCash =
      values.origin === "NOT_RECORDED"
        ? parseOpeningMoney(values.initialCashDisplay)
        : undefined
    if (initialCash === null) return null
    return {
      ...common,
      kind: "ALLOCATION",
      bookCostMinor: amount,
      ...(quantity === undefined ? {} : { quantity }),
      ...(values.origin === "NOT_RECORDED" && !confirmedBalance
        ? {
            proposedOpeningBalanceMinor: (
              BigInt(amount) + BigInt(initialCash ?? "0")
            ).toString(),
          }
        : {}),
    }
  }
  if (values.origin === "NOT_RECORDED") return null
  if (
    values.origin === "EXTERNAL_ACCOUNT" &&
    !externalAccountIds.includes(values.externalAccountId)
  )
    return null
  return {
    ...common,
    kind: "PURCHASE",
    type: values.mode === "BUY" ? "PURCHASE" : "APPLICATION",
    currency,
    capitalMinor: amount,
    description: values.description.trim() || "Abertura de investimento",
    funding:
      values.origin === "EXTERNAL_ACCOUNT"
        ? { mode: "EXTERNAL_ACCOUNT", accountId: values.externalAccountId }
        : { mode: "INTERNAL_CASH" },
    ...(quantity === undefined ? {} : { quantityDelta: quantity }),
  }
}

export function OpenInvestmentPositionForm({ onSuccess, onCancel }: Props) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const book = useBookDetail(bookId ?? undefined)
  const accounts = useInvestmentAccounts()
  const instruments = useInvestmentInstruments("ACTIVE")
  const balances = useAccountBalances()
  const [catalog, setCatalog] = useState<"account" | "instrument" | null>(null)
  const [confirmedBalance, setConfirmedBalance] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<OpeningFormValues>({
    resolver: zodResolver(openingFormSchema),
    defaultValues: openingFormDefaults,
  })
  const values = useWatch({ control: form.control }) as OpeningFormValues
  const currency = book.data?.baseCurrency ?? "BRL"
  const wallet = accounts.data?.find(
    (account) => account.id === values.investmentAccountId
  )
  const instrument = instruments.data?.find(
    (item) => item.id === values.instrumentId
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
          account.currency === currency
      ) ?? [],
    [balances.data, currency]
  )
  const fixedIncome =
    instrument !== undefined &&
    [
      "CDB",
      "RDB",
      "LCI",
      "LCA",
      "LC",
      "CRI",
      "CRA",
      "DEBENTURE",
      "LF",
      "LIG",
      "TREASURY",
    ].includes(instrument.type)
  const unitsRequired = Boolean(
    instrument && UNIT_REQUIRED_TYPES.has(instrument.type)
  )

  const intentKey = `${bookId ?? "none"}:${JSON.stringify(values)}`
  const opening = useInvestmentSubmission<OpenInvestmentPositionCommand>({
    intentKey: `open:${intentKey}`,
    execute: (input) =>
      services.investments.positions.open.execute({
        ...input.draft,
        bookId: input.bookId,
        requestId: input.requestId,
      }),
  })
  const purchase =
    useInvestmentSubmission<OpenInvestmentPositionWithPurchaseCommand>({
      intentKey: `purchase:${intentKey}`,
      execute: (input) =>
        services.investments.positions.openWithPurchase.execute({
          ...input.draft,
          bookId: input.bookId,
          requestId: input.requestId,
        }),
    })
  const balance = useInvestmentSubmission<SetInvestmentOpeningBalanceCommand>({
    intentKey: `balance:${intentKey}`,
    execute: (input) =>
      services.investments.accounts.setOpeningBalance.execute({
        ...input.draft,
        bookId: input.bookId,
        requestId: input.requestId,
      }),
  })
  const pending =
    form.formState.isSubmitting ||
    opening.isPending ||
    purchase.isPending ||
    balance.isPending

  useEffect(() => {
    if (
      values.origin !== "EXTERNAL_ACCOUNT" ||
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
    values.origin,
    values.externalAccountId,
    wallet?.defaultSettlementAccountId,
  ])

  useEffect(() => {
    if (values.mode === "BUY" && values.origin === "NOT_RECORDED")
      form.setValue("origin", "INTERNAL_CASH")
  }, [form, values.mode, values.origin])

  useEffect(() => {
    if (unitsRequired && values.quantityMode !== "UNITS")
      form.setValue("quantityMode", "UNITS")
  }, [form, unitsRequired, values.quantityMode])
  const previewCommand = openingPreviewCommand({
    values,
    bookId,
    currency: book.data?.baseCurrency,
    walletId: wallet?.id,
    instrumentId: instrument?.id,
    fixedIncome: Boolean(fixedIncome),
    unitsRequired,
    confirmedBalance,
    externalAccountIds: externalAccounts.map((account) => account.accountId),
  })
  const previewQuery = useQuery({
    queryKey: ["investments", bookId, "opening-preview", previewCommand],
    queryFn: () =>
      previewCommand === null
        ? Promise.reject(new Error("Opening preview is unavailable"))
        : services.investments.positions.previewOpening.execute(previewCommand),
    enabled: previewCommand !== null,
    retry: false,
  })
  const preview = previewQuery.data?.ok ? previewQuery.data.value : null
  const previewError =
    previewQuery.data && !previewQuery.data.ok ? previewQuery.data.error : null
  const negativeCash = preview?.warnings.some(
    (warning) => warning.code === "INVESTMENT_CASH_NEGATIVE"
  )

  const submit = form.handleSubmit(async (draft) => {
    setFailure(null)
    if (!bookId || !book.data || !wallet || !instrument) {
      if (!wallet)
        form.setError("investmentAccountId", { message: "Escolha a carteira." })
      if (!instrument)
        form.setError("instrumentId", { message: "Escolha o instrumento." })
      return
    }
    if (unitsRequired && draft.quantityMode !== "UNITS") {
      form.setError("quantityMode", { message: "Informe a quantidade." })
      return
    }
    const amount = parseOpeningMoney(draft.costDisplay)
    if (amount === null || (draft.mode === "BUY" && amount === "0")) {
      form.setError("costDisplay", {
        message:
          draft.mode === "OWNED"
            ? "Informe o custo contábil."
            : "Informe o valor principal.",
      })
      return
    }
    if (draft.mode === "BUY" && draft.origin === "NOT_RECORDED") {
      form.setError("origin", { message: "Escolha a origem do dinheiro." })
      return
    }
    const cash = parseOpeningMoney(draft.initialCashDisplay)
    if (draft.origin === "NOT_RECORDED" && cash === null) {
      form.setError("initialCashDisplay", {
        message: "Informe o caixa inicial real.",
      })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.occurredOn)) {
      form.setError("occurredOn", { message: "Informe a data da abertura." })
      return
    }
    const quantity =
      draft.quantityMode === "UNITS"
        ? parseOpeningQuantity(draft.quantity)
        : undefined
    if (draft.quantityMode === "UNITS" && quantity === null) {
      form.setError("quantity", { message: "Informe a quantidade." })
      return
    }
    if (
      draft.origin === "EXTERNAL_ACCOUNT" &&
      !externalAccounts.some(
        (account) => account.accountId === draft.externalAccountId
      )
    ) {
      form.setError("externalAccountId", {
        message: "Escolha a conta de origem.",
      })
      return
    }
    const termsError = fixedIncome ? validTerms(draft) : null
    if (termsError !== null) {
      setFailure(termsError)
      return
    }
    const common = {
      bookId,
      investmentAccountId: wallet.id,
      instrumentId: instrument.id,
      quantityMode: draft.quantityMode,
      ...(optional(draft.label) ? { label: optional(draft.label) } : {}),
      ...(fixedIncome && selectedTerms(draft)
        ? { fixedIncomeTerms: selectedTerms(draft) }
        : {}),
    } as const
    try {
      let result: InvestmentMutationResult
      if (draft.mode === "OWNED" && draft.origin !== "EXTERNAL_ACCOUNT") {
        if (draft.origin === "NOT_RECORDED" && !confirmedBalance) {
          await balance.submit({
            bookId,
            requestId: balance.requestId,
            accountId: wallet.id,
            amountMinor: (BigInt(amount) + BigInt(cash ?? "0")).toString(),
            currency,
            occurredOn: draft.occurredOn,
            description: "Saldo inicial explícito da carteira",
          })
          setConfirmedBalance(true)
        }
        result = await opening.submit({
          ...common,
          bookId,
          requestId: opening.requestId,
          bookCostMinor: amount,
          occurredOn: draft.occurredOn,
          ...(quantity === undefined || quantity === null ? {} : { quantity }),
        })
      } else {
        const external = draft.origin === "EXTERNAL_ACCOUNT"
        result = await purchase.submit({
          ...common,
          bookId,
          requestId: purchase.requestId,
          type: draft.mode === "BUY" ? "PURCHASE" : "APPLICATION",
          capitalMinor: amount,
          currency,
          occurredOn: draft.occurredOn,
          description: draft.description.trim() || "Abertura de investimento",
          funding: external
            ? { mode: "EXTERNAL_ACCOUNT", accountId: draft.externalAccountId }
            : { mode: "INTERNAL_CASH" },
          ...(quantity === undefined || quantity === null
            ? {}
            : { quantityDelta: quantity }),
        })
      }
      onSuccess?.(result)
    } catch (error) {
      const message = openingErrorMessage(error)
      setFailure(message)
      toast.add({
        type: "error",
        title: "Não foi possível salvar o investimento",
        description: message,
      })
    }
  })

  if (bookId === null)
    return (
      <Alert>
        <AlertTitle>Selecione um livro antes de abrir investimento</AlertTitle>
        <AlertDescription>
          O formulário será liberado quando houver um livro ativo.
        </AlertDescription>
      </Alert>
    )
  if (book.isPending || (book.data === undefined && !book.isError))
    return (
      <Alert>
        <AlertTitle>Carregando moeda do livro</AlertTitle>
      </Alert>
    )
  if (book.isError || book.data === undefined)
    return (
      <Alert>
        <AlertTitle>Não foi possível carregar a moeda do livro</AlertTitle>
        <AlertDescription>
          Tente novamente após atualizar o livro.
        </AlertDescription>
      </Alert>
    )
  if (catalog === "account")
    return (
      <section className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Cadastre uma carteira de investimento. O cadastro é independente da
          abertura.
        </p>
        <AccountForm
          lockedType="INVESTMENT_ACCOUNT"
          onSuccess={(id) => {
            form.setValue("investmentAccountId", id)
            setCatalog(null)
          }}
          onCancel={() => setCatalog(null)}
        />
      </section>
    )
  if (catalog === "instrument")
    return (
      <InvestmentInstrumentForm
        onSuccess={(created) => {
          form.setValue("instrumentId", created.id)
          setCatalog(null)
        }}
        onCancel={() => setCatalog(null)}
      />
    )

  return (
    <form className="flex w-full min-w-0 flex-col gap-6" onSubmit={submit}>
      <FieldGroup>
        <ControlledToggleGroup
          control={form.control}
          name="mode"
          label="Modo de abertura"
          options={[
            { value: "OWNED", label: "Já possuo" },
            { value: "BUY", label: "Comprar/Aplicar" },
          ]}
          disabled={pending || confirmedBalance}
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <ControlledSelect
            control={form.control}
            name="investmentAccountId"
            label="Carteira"
            options={(accounts.data ?? [])
              .filter(
                (account) =>
                  account.status === "ACTIVE" && account.currency === currency
              )
              .map((account) => ({ value: account.id, label: account.name }))}
            disabled={pending || confirmedBalance}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setCatalog("account")}
            disabled={pending || confirmedBalance}
          >
            Cadastrar carteira
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <ControlledSelect
            control={form.control}
            name="instrumentId"
            label="Instrumento"
            options={(instruments.data ?? [])
              .filter(
                (item) => item.status === "ACTIVE" && item.currency === currency
              )
              .map((item) => ({ value: item.id, label: item.name }))}
            disabled={pending || confirmedBalance}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setCatalog("instrument")}
            disabled={pending || confirmedBalance}
          >
            Cadastrar instrumento
          </Button>
        </div>
        <ControlledToggleGroup
          control={form.control}
          name="origin"
          label="Origem contábil"
          options={[
            { value: "INTERNAL_CASH", label: "Na carteira" },
            { value: "EXTERNAL_ACCOUNT", label: "Em outra conta" },
            ...(values.mode === "OWNED"
              ? [{ value: "NOT_RECORDED", label: "Não consta" }]
              : []),
          ]}
          disabled={pending || confirmedBalance}
        />
        {values.origin === "EXTERNAL_ACCOUNT" && (
          <ControlledSelect
            control={form.control}
            name="externalAccountId"
            label="Conta de origem"
            options={externalAccounts.map((account) => ({
              value: account.accountId,
              label: account.accountName,
            }))}
            disabled={pending || confirmedBalance}
            description="Confirme a conta de origem externa antes de salvar."
          />
        )}
        <ControlledInput
          control={form.control}
          name="label"
          label="Rótulo da posição"
          disabled={pending || confirmedBalance}
          maxLength={120}
        />
        <ControlledToggleGroup
          control={form.control}
          name="quantityMode"
          label="Controle de quantidade"
          options={[
            ...(unitsRequired ? [] : [{ value: "AMOUNT", label: "Por valor" }]),
            { value: "UNITS", label: "Por unidades" },
          ]}
          disabled={pending || confirmedBalance}
        />
        {values.quantityMode === "UNITS" && (
          <ControlledInput
            control={form.control}
            name="quantity"
            label="Quantidade"
            disabled={pending || confirmedBalance}
          />
        )}
        <ControlledInput
          control={form.control}
          name="costDisplay"
          label={values.mode === "BUY" ? "Valor principal" : "Custo contábil"}
          disabled={pending || confirmedBalance}
          description={`Em ${currency}; valor atual não substitui custo.`}
        />
        {values.mode === "OWNED" && (
          <ControlledInput
            control={form.control}
            name="valuationDisplay"
            label="Valor atual estimado"
            disabled={pending || confirmedBalance}
            description="Opcional e informativo; a avaliação é registrada depois, em ação separada."
          />
        )}
        {values.mode === "OWNED" && values.origin === "NOT_RECORDED" && (
          <ControlledInput
            control={form.control}
            name="initialCashDisplay"
            label="Caixa inicial real"
            disabled={pending || confirmedBalance}
            description="Soma-se ao custo no saldo inicial explícito; não inclui valorização."
          />
        )}
        <ControlledInput
          control={form.control}
          name="occurredOn"
          label="Data da abertura"
          type="date"
          disabled={pending || confirmedBalance}
        />
        {values.mode === "BUY" && (
          <ControlledInput
            control={form.control}
            name="description"
            label="Descrição"
            disabled={pending || confirmedBalance}
            maxLength={500}
          />
        )}
        {fixedIncome && (
          <section
            className="grid gap-4 rounded-2xl border border-border p-4"
            aria-label="Termos de renda fixa"
          >
            <h3 className="text-sm font-medium">
              Termos de renda fixa, opcionais
            </h3>
            <ControlledSelect
              control={form.control}
              name="rateKind"
              label="Tipo de taxa"
              options={[
                { value: "PREFIXED", label: "Prefixada" },
                { value: "INDEXED", label: "Indexada" },
                { value: "HYBRID", label: "Híbrida" },
              ]}
              disabled={pending || confirmedBalance}
            />
            {(values.rateKind === "INDEXED" ||
              values.rateKind === "HYBRID") && (
              <>
                <ControlledSelect
                  control={form.control}
                  name="index"
                  label="Índice"
                  options={["CDI", "SELIC", "IPCA", "IGPM", "OTHER"].map(
                    (value) => ({ value, label: value })
                  )}
                  disabled={pending || confirmedBalance}
                />
                <ControlledInput
                  control={form.control}
                  name="indexPercentage"
                  label="Percentual do índice"
                  disabled={pending || confirmedBalance}
                />
              </>
            )}
            {values.rateKind === "PREFIXED" && (
              <ControlledInput
                control={form.control}
                name="annualRate"
                label="Taxa anual"
                disabled={pending || confirmedBalance}
              />
            )}
            {values.rateKind === "HYBRID" && (
              <ControlledInput
                control={form.control}
                name="annualSpreadRate"
                label="Spread anual"
                disabled={pending || confirmedBalance}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <ControlledInput
                control={form.control}
                name="issueDate"
                label="Data de emissão"
                type="date"
                disabled={pending || confirmedBalance}
              />
              <ControlledInput
                control={form.control}
                name="gracePeriodDate"
                label="Data de carência"
                type="date"
                disabled={pending || confirmedBalance}
              />
              <ControlledInput
                control={form.control}
                name="maturityDate"
                label="Data de vencimento"
                type="date"
                disabled={pending || confirmedBalance}
              />
            </div>
          </section>
        )}
      </FieldGroup>
      <Card size="sm" aria-label="Prévia da abertura">
        <CardHeader>
          <CardTitle>Prévia da abertura</CardTitle>
          <CardDescription>
            Calculada com o estado atual; a confirmação revalida os dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2" aria-live="polite">
          {previewCommand === null && (
            <p>Preencha os dados da abertura para calcular a prévia.</p>
          )}
          {previewQuery.isFetching && <p>Calculando prévia...</p>}
          {(previewError || previewQuery.isError) && (
            <Alert variant="destructive">
              <AlertTitle>Prévia indisponível</AlertTitle>
              <AlertDescription>
                {previewError
                  ? openingErrorMessage(previewError)
                  : "Não foi possível calcular a prévia. Tente novamente."}
              </AlertDescription>
            </Alert>
          )}
          {preview && (
            <>
              <p>
                Custo: {formatMinorAmount(preview.bookCostDeltaMinor, currency)}
              </p>
              <p>
                Fluxo líquido:{" "}
                {formatMinorAmount(preview.netCashFlowMinor, currency)}
              </p>
              <p>
                Caixa da carteira:{" "}
                {formatMinorAmount(preview.projectedCashMinor, currency)}
              </p>
              {preview.openingBalanceMinor !== undefined && (
                <p>
                  Saldo inicial proposto:{" "}
                  {formatMinorAmount(preview.openingBalanceMinor, currency)}
                </p>
              )}
              {preview.postings.length > 0 && (
                <div>
                  <p>Efeito em contas:</p>
                  <ul className="list-inside list-disc">
                    {preview.postings.map((posting, index) => (
                      <li key={posting.accountId + ":" + index}>
                        {posting.accountId === wallet?.id
                          ? wallet.name
                          : (externalAccounts.find(
                              (account) =>
                                account.accountId === posting.accountId
                            )?.accountName ?? posting.accountId)}
                        : {formatMinorAmount(posting.amountMinor, currency)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {negativeCash && (
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
      {confirmedBalance && (
        <Alert>
          <AlertTitle>Saldo inicial confirmado</AlertTitle>
          <AlertDescription>
            A alocação pode ser tentada novamente sem registrar outro saldo
            inicial.
          </AlertDescription>
        </Alert>
      )}
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
        <Alert>
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
          {pending && <Spinner aria-hidden="true" />}
          {pending ? "Salvando investimento" : "Salvar investimento"}
        </Button>
      </div>
    </form>
  )
}
