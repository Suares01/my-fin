import type {
  InvestmentAccountView,
  InvestmentInstrumentView,
} from "@workspace/application"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { ChevronDown, Plus, Search } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { Controller, type Control } from "react-hook-form"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledSelect } from "../../../components/forms/controlled-select"
import { ControlledToggleGroup } from "../../../components/forms/controlled-toggle-group"
import type {
  OpeningFormValues,
  OpeningRegistrationStep,
} from "./open-investment-position-form-model"
import { filterInvestmentInstruments } from "./investment-registration-search"

const registrationSteps: readonly {
  readonly id: OpeningRegistrationStep
  readonly label: string
}[] = [
  { id: "CHOICE", label: "Escolha" },
  { id: "POSITION", label: "Posição" },
  { id: "ACCOUNTING", label: "Origem" },
  { id: "REVIEW", label: "Revisão" },
]

export function InvestmentRegistrationProgress({
  current,
}: {
  readonly current: OpeningRegistrationStep
}) {
  const currentIndex = registrationSteps.findIndex(
    (step) => step.id === current
  )
  return (
    <ol
      className="grid grid-cols-4 gap-2"
      aria-label="Etapas do cadastro de investimento"
    >
      {registrationSteps.map((step, index) => (
        <li
          key={step.id}
          aria-current={step.id === current ? "step" : undefined}
          className="flex min-w-0 flex-col gap-1"
        >
          <span
            className={
              index <= currentIndex
                ? "h-1 rounded-full bg-primary"
                : "h-1 rounded-full bg-muted"
            }
          />
          <span
            className={
              step.id === current
                ? "truncate text-xs font-medium text-foreground"
                : "truncate text-xs text-muted-foreground"
            }
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function InstrumentPicker({
  control,
  instruments,
  disabled,
  onCreate,
}: {
  readonly control: Control<OpeningFormValues>
  readonly instruments: readonly InvestmentInstrumentView[]
  readonly disabled: boolean
  readonly onCreate: () => void
}) {
  const inputId = useId()
  const [search, setSearch] = useState("")
  const filtered = useMemo(
    () => filterInvestmentInstruments(instruments, search),
    [instruments, search]
  )

  return (
    <Controller
      control={control}
      name="instrumentId"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={inputId}>Instrumento</FieldLabel>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
            />
            <Input
              ref={field.ref}
              id={inputId}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onBlur={field.onBlur}
              placeholder="Busque por nome, tipo ou código"
              autoComplete="off"
              disabled={disabled}
              className="pl-9"
              aria-invalid={fieldState.invalid}
              aria-describedby={
                fieldState.error ? `${inputId}-error` : `${inputId}-help`
              }
            />
          </div>
          <FieldDescription id={`${inputId}-help`}>
            Selecione um ativo existente ou cadastre outro sem perder o
            preenchimento.
          </FieldDescription>
          <div
            role="listbox"
            aria-label="Instrumentos encontrados"
            className="grid max-h-48 gap-2 overflow-y-auto rounded-2xl border border-border p-2"
          >
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Nenhum instrumento encontrado.
              </p>
            ) : (
              filtered.map((instrument) => (
                <Button
                  key={instrument.id}
                  type="button"
                  role="option"
                  aria-selected={field.value === instrument.id}
                  variant={
                    field.value === instrument.id ? "secondary" : "ghost"
                  }
                  className="h-auto min-h-11 justify-between px-3 py-2 text-left whitespace-normal"
                  disabled={disabled}
                  onClick={() => {
                    field.onChange(instrument.id)
                    setSearch(instrument.name)
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {instrument.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[instrument.type, instrument.issuerName]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <Badge variant="outline">{instrument.type}</Badge>
                </Button>
              ))
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={onCreate}
            disabled={disabled}
          >
            <Plus aria-hidden="true" />
            Cadastrar novo instrumento
          </Button>
          <FieldError id={`${inputId}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function InvestmentRegistrationChoiceStep({
  control,
  accounts,
  instruments,
  currency,
  disabled,
  onCreateWallet,
  onCreateInstrument,
}: {
  readonly control: Control<OpeningFormValues>
  readonly accounts: readonly InvestmentAccountView[]
  readonly instruments: readonly InvestmentInstrumentView[]
  readonly currency: string
  readonly disabled: boolean
  readonly onCreateWallet: () => void
  readonly onCreateInstrument: () => void
}) {
  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="choice-step-title"
    >
      <div className="space-y-1">
        <h2 id="choice-step-title" className="text-lg font-medium">
          O que você quer registrar?
        </h2>
        <p className="text-sm text-muted-foreground">
          Comece pelo cenário e escolha onde este investimento fica guardado.
        </p>
      </div>
      <FieldGroup>
        <ControlledToggleGroup
          control={control}
          name="mode"
          label="Modo de abertura"
          description="Escolha entre reconhecer uma posição existente ou registrar uma compra agora."
          options={[
            { value: "OWNED", label: "Já tenho este investimento" },
            { value: "BUY", label: "Estou comprando ou aplicando" },
          ]}
          disabled={disabled}
        />
        <InstrumentPicker
          control={control}
          instruments={instruments.filter(
            (instrument) =>
              instrument.status === "ACTIVE" && instrument.currency === currency
          )}
          disabled={disabled}
          onCreate={onCreateInstrument}
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <ControlledSelect
            control={control}
            name="investmentAccountId"
            label="Carteira"
            description="A carteira representa a corretora ou o local de custódia."
            options={accounts
              .filter(
                (account) =>
                  account.status === "ACTIVE" && account.currency === currency
              )
              .map((account) => ({ value: account.id, label: account.name }))}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onCreateWallet}
            disabled={disabled}
          >
            <Plus aria-hidden="true" />
            Nova carteira
          </Button>
        </div>
      </FieldGroup>
    </section>
  )
}

export function InvestmentRegistrationPositionStep({
  control,
  mode,
  currency,
  fixedIncome,
  unitsRequired,
  rateKind,
  quantityMode,
  disabled,
}: {
  readonly control: Control<OpeningFormValues>
  readonly mode: OpeningFormValues["mode"]
  readonly currency: string
  readonly fixedIncome: boolean
  readonly unitsRequired: boolean
  readonly rateKind: OpeningFormValues["rateKind"]
  readonly quantityMode: OpeningFormValues["quantityMode"]
  readonly disabled: boolean
}) {
  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="position-step-title"
    >
      <div className="space-y-1">
        <h2 id="position-step-title" className="text-lg font-medium">
          Dados da posição
        </h2>
        <p className="text-sm text-muted-foreground">
          Informe o custo conhecido. O valor atual poderá ser registrado
          separadamente depois que a posição for criada.
        </p>
      </div>
      <FieldGroup>
        {unitsRequired ? (
          <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
            Este ativo é controlado por unidades. Informe a quantidade que você
            possui.
          </p>
        ) : (
          <ControlledToggleGroup
            control={control}
            name="quantityMode"
            label="Como você acompanha este investimento?"
            options={[
              { value: "AMOUNT", label: "Somente pelo valor" },
              { value: "UNITS", label: "Por quantidade" },
            ]}
            disabled={disabled}
          />
        )}
        {(unitsRequired || quantityMode === "UNITS") && (
          <ControlledInput
            control={control}
            name="quantity"
            label="Quantidade"
            description="Use até 18 casas decimais quando necessário."
            disabled={disabled}
          />
        )}
        <ControlledInput
          control={control}
          name="costDisplay"
          label={mode === "BUY" ? "Valor principal" : "Custo contábil"}
          description={
            mode === "BUY"
              ? `Valor que será alocado, em ${currency}.`
              : `Quanto foi aplicado originalmente, em ${currency}. Não use o valor de mercado atual.`
          }
          disabled={disabled}
        />
        <ControlledInput
          control={control}
          name="occurredOn"
          label={
            mode === "BUY" ? "Data da compra ou aplicação" : "Data da abertura"
          }
          type="date"
          disabled={disabled}
        />
        <Collapsible>
          <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-border px-4 py-2 text-left text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none">
            Detalhes avançados
            <ChevronDown aria-hidden="true" className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-5">
            <FieldGroup>
              <ControlledInput
                control={control}
                name="label"
                label="Rótulo da posição"
                description="Opcional. Use apenas se precisar diferenciar posições do mesmo ativo."
                disabled={disabled}
                maxLength={120}
              />
              {mode === "BUY" && (
                <ControlledInput
                  control={control}
                  name="description"
                  label="Descrição"
                  disabled={disabled}
                  maxLength={500}
                />
              )}
              {fixedIncome && (
                <section
                  className="grid gap-4 rounded-2xl border border-border p-4"
                  aria-label="Termos de renda fixa"
                >
                  <div>
                    <h3 className="text-sm font-medium">
                      Termos de renda fixa
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Opcionais. Deixe em branco o que você não souber.
                    </p>
                  </div>
                  <ControlledSelect
                    control={control}
                    name="rateKind"
                    label="Tipo de taxa"
                    options={[
                      { value: "PREFIXED", label: "Prefixada" },
                      { value: "INDEXED", label: "Indexada" },
                      { value: "HYBRID", label: "Híbrida" },
                    ]}
                    disabled={disabled}
                  />
                  {(rateKind === "INDEXED" || rateKind === "HYBRID") && (
                    <>
                      <ControlledSelect
                        control={control}
                        name="index"
                        label="Índice"
                        options={["CDI", "SELIC", "IPCA", "IGPM", "OTHER"].map(
                          (value) => ({ value, label: value })
                        )}
                        disabled={disabled}
                      />
                      <ControlledInput
                        control={control}
                        name="indexPercentage"
                        label="Percentual do índice"
                        disabled={disabled}
                      />
                    </>
                  )}
                  {rateKind === "PREFIXED" && (
                    <ControlledInput
                      control={control}
                      name="annualRate"
                      label="Taxa anual"
                      disabled={disabled}
                    />
                  )}
                  {rateKind === "HYBRID" && (
                    <ControlledInput
                      control={control}
                      name="annualSpreadRate"
                      label="Spread anual"
                      disabled={disabled}
                    />
                  )}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ControlledInput
                      control={control}
                      name="issueDate"
                      label="Data de emissão"
                      type="date"
                      disabled={disabled}
                    />
                    <ControlledInput
                      control={control}
                      name="gracePeriodDate"
                      label="Data de carência"
                      type="date"
                      disabled={disabled}
                    />
                    <ControlledInput
                      control={control}
                      name="maturityDate"
                      label="Data de vencimento"
                      type="date"
                      disabled={disabled}
                    />
                  </div>
                </section>
              )}
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      </FieldGroup>
    </section>
  )
}

export function InvestmentRegistrationAccountingStep({
  control,
  mode,
  origin,
  externalAccounts,
  disabled,
}: {
  readonly control: Control<OpeningFormValues>
  readonly mode: OpeningFormValues["mode"]
  readonly origin: OpeningFormValues["origin"]
  readonly externalAccounts: readonly {
    readonly accountId: string
    readonly accountName: string
  }[]
  readonly disabled: boolean
}) {
  const description =
    mode === "BUY"
      ? "Escolha de onde o dinheiro sairá. Nenhuma transferência será criada fora desta confirmação."
      : origin === "INTERNAL_CASH"
        ? "O patrimônio já está no saldo da carteira. A abertura apenas separa custo investido e caixa."
        : origin === "EXTERNAL_ACCOUNT"
          ? "O valor já está em outra conta do My Fin. A aplicação será registrada em uma única operação."
          : "O patrimônio ainda não aparece no livro. A revisão mostrará um saldo inicial explícito antes da alocação."

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="accounting-step-title"
    >
      <div className="space-y-1">
        <h2 id="accounting-step-title" className="text-lg font-medium">
          {mode === "BUY"
            ? "De onde virá o dinheiro?"
            : "Como este valor já aparece no My Fin?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Esta escolha muda o patrimônio e o caixa. Revise com atenção.
        </p>
      </div>
      <FieldGroup>
        <ControlledToggleGroup
          control={control}
          name="origin"
          label={mode === "BUY" ? "Origem do dinheiro" : "Situação atual"}
          description={description}
          options={
            mode === "BUY"
              ? [
                  { value: "INTERNAL_CASH", label: "Usar caixa da carteira" },
                  { value: "EXTERNAL_ACCOUNT", label: "Usar outra conta" },
                ]
              : [
                  {
                    value: "INTERNAL_CASH",
                    label: "Já está no caixa da carteira",
                  },
                  {
                    value: "EXTERNAL_ACCOUNT",
                    label: "Saiu de outra conta",
                  },
                  {
                    value: "NOT_RECORDED",
                    label: "Ainda não aparece no My Fin",
                  },
                ]
          }
          disabled={disabled}
        />
        {origin === "EXTERNAL_ACCOUNT" && (
          <ControlledSelect
            control={control}
            name="externalAccountId"
            label="Conta de origem"
            options={externalAccounts.map((account) => ({
              value: account.accountId,
              label: account.accountName,
            }))}
            disabled={disabled}
            description="A conta padrão é apenas uma sugestão; confirme a conta usada nesta operação."
          />
        )}
        {mode === "OWNED" && origin === "NOT_RECORDED" && (
          <ControlledInput
            control={control}
            name="initialCashDisplay"
            label="Caixa real que já existe na carteira"
            description="Informe apenas dinheiro livre além do custo da posição. Não inclua valorização."
            disabled={disabled}
          />
        )}
      </FieldGroup>
    </section>
  )
}
