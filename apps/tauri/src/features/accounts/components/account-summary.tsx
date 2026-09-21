import { formatMinorAmount } from "@workspace/ui/money"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { InvestmentPortfolioSummary } from "@workspace/application"
import { Landmark, WalletCards, WalletMinimal } from "lucide-react"
import { summarizeAccounts } from "./account-summary-model"

interface AccountSummaryProps {
  readonly summary: InvestmentPortfolioSummary | undefined
  readonly isPending: boolean
  readonly isError: boolean
  readonly onRetry: () => void
}

export function AccountSummary({
  summary,
  isPending,
  isError,
  onRetry,
}: AccountSummaryProps) {
  if (isPending) return <AccountSummarySkeleton />

  if (isError || summary === undefined) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar o resumo contábil</AlertTitle>
        <AlertDescription>
          O resumo anterior não foi substituído por valores zerados. Tente
          atualizá-lo para continuar.
        </AlertDescription>
        <Button className="mt-3" variant="outline" onClick={onRetry}>
          Tentar carregar resumo novamente
        </Button>
      </Alert>
    )
  }

  const accountSummary = summarizeAccounts(summary)

  return (
    <section aria-label="Resumo contábil" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Moeda-base: {accountSummary.currency}</Badge>
        <p className="text-sm text-muted-foreground">
          Os valores do resumo usam a moeda do livro.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {accountSummary.cards.map((card) => {
          const Icon = iconFor(card.kind)
          return (
            <Card key={card.label} size="sm" className="gap-3">
              <CardContent className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-base font-semibold tracking-tight tabular-nums">
                    {formatMinorAmount(
                      card.valueMinor,
                      accountSummary.currency
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {accountSummary.hasOtherAssets && (
        <Alert>
          <AlertTitle>Outros ativos não são dinheiro disponível</AlertTitle>
          <AlertDescription>
            Essa classificação é válida para ativos que não são dinheiro de uso
            diário. Você pode revisar a finalidade da conta sem criar
            lançamentos.
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}

function iconFor(
  kind: "NET_WORTH" | "AVAILABLE" | "OTHER_ASSETS" | "ARCHIVED_DAILY"
) {
  if (kind === "NET_WORTH") return WalletCards
  if (kind === "OTHER_ASSETS") return WalletMinimal
  return Landmark
}

function AccountSummarySkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Carregando resumo contábil"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-28" />
      ))}
    </div>
  )
}
