import type { InvestmentOpeningPreview } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { formatMinorAmount } from "@workspace/ui/money"
import { Check, RefreshCw } from "lucide-react"
import type { OpeningFormValues } from "./open-investment-position-form-model"

function originLabel(values: OpeningFormValues): string {
  if (values.origin === "EXTERNAL_ACCOUNT") return "Outra conta do My Fin"
  if (values.origin === "NOT_RECORDED")
    return "Patrimônio ainda não registrado"
  return values.mode === "BUY" ? "Caixa da carteira" : "Já está na carteira"
}

function ReviewItem({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="grid gap-1 rounded-2xl bg-muted/50 px-4 py-3">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}

export function InvestmentRegistrationReview({
  values,
  walletName,
  instrumentName,
  externalAccountNames,
  currency,
  preview,
  previewPending,
  previewError,
  onRetryPreview,
  needsOpeningBalanceConfirmation,
  openingBalanceConfirmed,
  onConfirmOpeningBalance,
}: {
  readonly values: OpeningFormValues
  readonly walletName: string
  readonly instrumentName: string
  readonly externalAccountNames: Readonly<Record<string, string>>
  readonly currency: string
  readonly preview: InvestmentOpeningPreview | null
  readonly previewPending: boolean
  readonly previewError: string | null
  readonly onRetryPreview: () => void
  readonly needsOpeningBalanceConfirmation: boolean
  readonly openingBalanceConfirmed: boolean
  readonly onConfirmOpeningBalance: () => void
}) {
  const negativeCash = preview?.warnings.some(
    (warning) => warning.code === "INVESTMENT_CASH_NEGATIVE"
  )
  const amountLabel =
    values.mode === "BUY" ? "Valor principal" : "Custo contábil"

  return (
    <section className="flex flex-col gap-6" aria-labelledby="review-step-title">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="review-step-title" className="text-lg font-medium">
            Revise antes de confirmar
          </h2>
          <Badge variant="outline">
            {values.mode === "BUY" ? "Nova compra" : "Posição existente"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Confira os dados e o efeito contábil calculado com o estado atual do
          livro.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <ReviewItem label="Instrumento" value={instrumentName} />
        <ReviewItem label="Carteira" value={walletName} />
        <ReviewItem label={amountLabel} value={values.costDisplay} />
        <ReviewItem label="Origem" value={originLabel(values)} />
        {values.quantityMode === "UNITS" && (
          <ReviewItem label="Quantidade" value={values.quantity} />
        )}
        <ReviewItem label="Data" value={values.occurredOn} />
      </dl>

      <Card size="sm" aria-label="Prévia da abertura">
        <CardHeader>
          <CardTitle>Efeito no My Fin</CardTitle>
          <CardDescription>
            Esta prévia não salva nada. A confirmação final revalida os dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3" aria-live="polite">
          {previewPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner aria-hidden="true" />
              Calculando valores e saldos…
            </p>
          )}
          {previewError && (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível calcular a prévia</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                <span>{previewError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetryPreview}
                >
                  <RefreshCw aria-hidden="true" />
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {!previewPending && !previewError && preview === null && (
            <p className="text-sm text-muted-foreground">
              Volte e complete os dados para calcular a prévia.
            </p>
          )}
          {preview && !previewPending && !previewError && (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <ReviewItem
                  label="Custo alocado"
                  value={formatMinorAmount(
                    preview.bookCostDeltaMinor,
                    currency
                  )}
                />
                <ReviewItem
                  label="Movimento de caixa"
                  value={formatMinorAmount(preview.netCashFlowMinor, currency)}
                />
                <ReviewItem
                  label="Caixa da carteira após o registro"
                  value={formatMinorAmount(
                    preview.projectedCashMinor,
                    currency
                  )}
                />
                {preview.openingBalanceMinor !== undefined && (
                  <ReviewItem
                    label="Saldo inicial a registrar"
                    value={formatMinorAmount(
                      preview.openingBalanceMinor,
                      currency
                    )}
                  />
                )}
              </dl>

              {preview.postings.length > 0 ? (
                <div className="rounded-2xl border border-border p-4">
                  <h3 className="text-sm font-medium">Movimentos em contas</h3>
                  <ul className="mt-2 grid gap-2 text-sm">
                    {preview.postings.map((posting, index) => (
                      <li
                        key={`${posting.accountId}:${index}`}
                        className="flex justify-between gap-4"
                      >
                        <span className="text-muted-foreground">
                          {posting.accountId === values.investmentAccountId
                            ? walletName
                            : (externalAccountNames[posting.accountId] ??
                              "Conta vinculada")}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatMinorAmount(posting.amountMinor, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                  Nenhum lançamento será criado. O valor já contabilizado será
                  apenas separado entre custo investido e caixa da carteira.
                </p>
              )}

              {negativeCash && (
                <Alert>
                  <AlertTitle>O caixa da carteira ficará negativo</AlertTitle>
                  <AlertDescription>
                    O registro continua válido, mas indica que o dinheiro ainda
                    precisa ser conciliado no livro.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {needsOpeningBalanceConfirmation && preview?.openingBalanceMinor && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <h3 className="font-medium">Confirmação patrimonial necessária</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Você está prestes a registrar um saldo inicial de{" "}
            <strong className="text-foreground">
              {formatMinorAmount(preview.openingBalanceMinor, currency)}
            </strong>{" "}
            nesta carteira. Isso aumenta o patrimônio contábil do livro; não é
            uma avaliação de mercado.
          </p>
          <Button
            type="button"
            variant={openingBalanceConfirmed ? "secondary" : "outline"}
            className="mt-4"
            aria-pressed={openingBalanceConfirmed}
            onClick={onConfirmOpeningBalance}
          >
            {openingBalanceConfirmed && <Check aria-hidden="true" />}
            {openingBalanceConfirmed
              ? "Saldo inicial confirmado"
              : "Confirmar registro do saldo inicial"}
          </Button>
        </div>
      )}
    </section>
  )
}
