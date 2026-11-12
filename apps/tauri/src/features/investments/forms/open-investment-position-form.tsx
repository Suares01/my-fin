import type {
  InvestmentMutationResult,
  OpenInvestmentPositionCommand,
  OpenInvestmentPositionWithPurchaseCommand,
  SetInvestmentOpeningBalanceCommand,
} from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useActiveBook, useMyFin } from "../../../providers"
import { AccountForm } from "../../accounts/components/account-form"
import { useAccountBalances } from "../../accounts/hooks"
import { useBookDetail } from "../../books/hooks"
import { useInvestmentAccounts, useInvestmentInstruments } from "../hooks"
import { useInvestmentSubmission } from "../hooks/use-investment-submission"
import { InvestmentInstrumentForm } from "./investment-instrument-form"
import { InvestmentRegistrationReview } from "./investment-registration-review"
import {
  InvestmentRegistrationAccountingStep,
  InvestmentRegistrationChoiceStep,
  InvestmentRegistrationPositionStep,
  InvestmentRegistrationProgress,
} from "./investment-registration-steps"
import {
  isFixedIncome,
  isUnitsRequired,
  openingErrorMessage,
  openingFormDefaults,
  openingFormSchema,
  openingPreviewCommand,
  openingStepErrors,
  parseOpeningMoney,
  parseOpeningQuantity,
  selectedOpeningTerms,
  type OpeningFormValues,
  type OpeningRegistrationStep,
} from "./open-investment-position-form-model"

type Props = {
  readonly onSuccess?: (result: InvestmentMutationResult) => void
  readonly onCancel?: () => void
}

const stepOrder: readonly OpeningRegistrationStep[] = [
  "CHOICE",
  "POSITION",
  "ACCOUNTING",
  "REVIEW",
]

function optional(value: string): string | undefined {
  return value.trim() || undefined
}

export function OpenInvestmentPositionForm({ onSuccess, onCancel }: Props) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const book = useBookDetail(bookId ?? undefined)
  const accounts = useInvestmentAccounts()
  const instruments = useInvestmentInstruments("ACTIVE")
  const balances = useAccountBalances()
  const [step, setStep] = useState<OpeningRegistrationStep>("CHOICE")
  const [catalog, setCatalog] = useState<"account" | "instrument" | null>(null)
  const [confirmedBalance, setConfirmedBalance] = useState(false)
  const [acknowledgedBalanceKey, setAcknowledgedBalanceKey] = useState<
    string | null
  >(null)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<OpeningFormValues>({
    resolver: zodResolver(openingFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: openingFormDefaults,
  })
  const values = useWatch({ control: form.control }) as OpeningFormValues
  const currency = book.data?.baseCurrency
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
  const fixedIncome = isFixedIncome(instrument?.type)
  const unitsRequired = isUnitsRequired(instrument?.type)
  const externalAccountIds = externalAccounts.map(
    (account) => account.accountId
  )
  const balanceIntentKey = [
    values.investmentAccountId,
    values.costDisplay,
    values.initialCashDisplay,
    values.occurredOn,
  ].join(":")
  const openingBalanceAcknowledged = acknowledgedBalanceKey === balanceIntentKey

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
    currency,
    walletId: wallet?.id,
    instrumentId: instrument?.id,
    fixedIncome,
    unitsRequired,
    confirmedBalance,
    externalAccountIds,
  })
  const previewQuery = useQuery({
    queryKey: ["investments", bookId, "opening-preview", previewCommand],
    queryFn: () =>
      previewCommand === null
        ? Promise.reject(new Error("Opening preview is unavailable"))
        : services.investments.positions.previewOpening.execute(previewCommand),
    enabled: step === "REVIEW" && previewCommand !== null,
    retry: false,
  })
  const preview = previewQuery.data?.ok ? previewQuery.data.value : null
  const previewApplicationError =
    previewQuery.data && !previewQuery.data.ok ? previewQuery.data.error : null
  const previewError =
    previewApplicationError !== null
      ? openingErrorMessage(previewApplicationError)
      : previewQuery.isError
        ? "Não foi possível calcular a prévia. Tente novamente."
        : null
  const needsOpeningBalanceConfirmation =
    values.mode === "OWNED" &&
    values.origin === "NOT_RECORDED" &&
    !confirmedBalance

  function showErrorSummary(): void {
    window.requestAnimationFrame(() =>
      document.getElementById("investment-registration-errors")?.focus()
    )
  }

  function validateStep(target: OpeningRegistrationStep): boolean {
    form.clearErrors()
    const errors = openingStepErrors(target, values, {
      fixedIncome,
      unitsRequired,
      externalAccountIds,
    })
    const entries = Object.entries(errors) as [
      keyof OpeningFormValues,
      string,
    ][]
    if (entries.length === 0) return true
    for (const [field, message] of entries)
      form.setError(field, { type: "manual", message })
    setFailure(null)
    showErrorSummary()
    return false
  }

  function nextStep(): void {
    if (pending || confirmedBalance || !validateStep(step)) return
    const index = stepOrder.indexOf(step)
    const next = stepOrder[index + 1]
    if (next) {
      setFailure(null)
      setStep(next)
    }
  }

  function previousStep(): void {
    if (pending || confirmedBalance) return
    const index = stepOrder.indexOf(step)
    const previous = stepOrder[index - 1]
    if (previous) {
      form.clearErrors()
      setFailure(null)
      setStep(previous)
    }
  }

  const submit = form.handleSubmit(async (draft) => {
    setFailure(null)
    if (
      step !== "REVIEW" ||
      !validateStep("CHOICE") ||
      !validateStep("POSITION") ||
      !validateStep("ACCOUNTING")
    )
      return
    if (!bookId || !currency || !wallet || !instrument) {
      setFailure("Atualize os cadastros e revise a carteira e o instrumento.")
      showErrorSummary()
      return
    }
    if (preview === null || previewError !== null || previewQuery.isFetching) {
      setFailure("Aguarde uma prévia válida antes de confirmar.")
      showErrorSummary()
      return
    }
    if (needsOpeningBalanceConfirmation && !openingBalanceAcknowledged) {
      setFailure("Confirme o registro do saldo inicial antes de continuar.")
      showErrorSummary()
      return
    }

    const amount = parseOpeningMoney(draft.costDisplay)
    const cash = parseOpeningMoney(draft.initialCashDisplay)
    const quantity =
      draft.quantityMode === "UNITS"
        ? parseOpeningQuantity(draft.quantity)
        : undefined
    if (amount === null || cash === null || quantity === null) {
      setFailure("Revise os valores antes de confirmar.")
      showErrorSummary()
      return
    }

    const common = {
      bookId,
      investmentAccountId: wallet.id,
      instrumentId: instrument.id,
      quantityMode: draft.quantityMode,
      ...(optional(draft.label) ? { label: optional(draft.label) } : {}),
      ...(fixedIncome && selectedOpeningTerms(draft)
        ? { fixedIncomeTerms: selectedOpeningTerms(draft) }
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
            amountMinor: (BigInt(amount) + BigInt(cash)).toString(),
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
          ...(quantity === undefined ? {} : { quantity }),
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
          ...(quantity === undefined ? {} : { quantityDelta: quantity }),
        })
      }
      onSuccess?.(result)
    } catch (error) {
      const message = openingErrorMessage(error)
      setFailure(message)
      showErrorSummary()
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
  if (book.isError || currency === undefined)
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
        <div>
          <h2 className="text-lg font-medium">Nova carteira</h2>
          <p className="text-sm text-muted-foreground">
            Ao concluir, você voltará ao cadastro com a nova carteira
            selecionada.
          </p>
        </div>
        <AccountForm
          lockedType="INVESTMENT_ACCOUNT"
          settlementAccounts={externalAccounts.map((account) => ({
            id: account.accountId,
            name: account.accountName,
          }))}
          onSuccess={(id) => {
            form.setValue("investmentAccountId", id, {
              shouldDirty: true,
              shouldValidate: true,
            })
            setCatalog(null)
          }}
          onCancel={() => setCatalog(null)}
        />
      </section>
    )
  if (catalog === "instrument")
    return (
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium">Novo instrumento</h2>
          <p className="text-sm text-muted-foreground">
            Ao concluir, você voltará ao cadastro com o novo instrumento
            selecionado.
          </p>
        </div>
        <InvestmentInstrumentForm
          onSuccess={(created) => {
            form.setValue("instrumentId", created.id, {
              shouldDirty: true,
              shouldValidate: true,
            })
            setCatalog(null)
          }}
          onCancel={() => setCatalog(null)}
        />
      </section>
    )

  const errors = Object.values(form.formState.errors)
  const canSubmit =
    step === "REVIEW" &&
    preview !== null &&
    previewError === null &&
    !previewQuery.isFetching &&
    (!needsOpeningBalanceConfirmation || openingBalanceAcknowledged) &&
    !pending

  return (
    <form
      className="flex w-full min-w-0 flex-col gap-6"
      noValidate
      aria-busy={pending}
      onSubmit={submit}
    >
      <InvestmentRegistrationProgress current={step} />

      {(errors.length > 0 || failure) && (
        <div
          id="investment-registration-errors"
          role="alert"
          tabIndex={-1}
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 outline-none focus-visible:ring-3 focus-visible:ring-destructive/20"
        >
          <h2 className="font-medium">Revise antes de continuar</h2>
          {errors.map((issue, index) => (
            <p key={index} className="mt-1 text-sm">
              {String(issue?.message ?? "")}
            </p>
          ))}
          {failure && <p className="mt-1 text-sm">{failure}</p>}
        </div>
      )}

      {step === "CHOICE" && (
        <InvestmentRegistrationChoiceStep
          control={form.control}
          accounts={accounts.data ?? []}
          instruments={instruments.data ?? []}
          currency={currency}
          disabled={pending || confirmedBalance}
          onCreateWallet={() => setCatalog("account")}
          onCreateInstrument={() => setCatalog("instrument")}
        />
      )}
      {step === "POSITION" && (
        <InvestmentRegistrationPositionStep
          control={form.control}
          mode={values.mode}
          currency={currency}
          fixedIncome={fixedIncome}
          unitsRequired={unitsRequired}
          rateKind={values.rateKind}
          quantityMode={values.quantityMode}
          disabled={pending || confirmedBalance}
        />
      )}
      {step === "ACCOUNTING" && (
        <InvestmentRegistrationAccountingStep
          control={form.control}
          mode={values.mode}
          origin={values.origin}
          externalAccounts={externalAccounts}
          disabled={pending || confirmedBalance}
        />
      )}
      {step === "REVIEW" && (
        <InvestmentRegistrationReview
          values={values}
          walletName={wallet?.name ?? "Carteira indisponível"}
          instrumentName={instrument?.name ?? "Instrumento indisponível"}
          externalAccountNames={Object.fromEntries(
            externalAccounts.map((account) => [
              account.accountId,
              account.accountName,
            ])
          )}
          currency={currency}
          preview={preview}
          previewPending={previewQuery.isFetching}
          previewError={previewError}
          onRetryPreview={() => void previewQuery.refetch()}
          needsOpeningBalanceConfirmation={needsOpeningBalanceConfirmation}
          openingBalanceConfirmed={openingBalanceAcknowledged}
          onConfirmOpeningBalance={() =>
            setAcknowledgedBalanceKey(
              openingBalanceAcknowledged ? null : balanceIntentKey
            )
          }
        />
      )}

      {confirmedBalance && (
        <Alert>
          <AlertTitle>Saldo inicial já registrado</AlertTitle>
          <AlertDescription>
            A alocação pode ser tentada novamente sem criar outro saldo inicial.
            Os dados que alterariam esse saldo permanecem bloqueados.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <div className="flex flex-wrap justify-end gap-3">
          {step !== "CHOICE" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending || confirmedBalance}
              onClick={previousStep}
            >
              Voltar
            </Button>
          )}
          {step !== "REVIEW" ? (
            <Button
              type="button"
              disabled={pending || confirmedBalance}
              onClick={nextStep}
            >
              Continuar
            </Button>
          ) : (
            <Button type="submit" disabled={!canSubmit}>
              {pending && <Spinner aria-hidden="true" />}
              {pending ? "Salvando investimento" : "Confirmar investimento"}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
