import type { InvestmentAccountView } from "@workspace/application"
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ErrorState } from "@workspace/ui/components/error-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatMinorAmount } from "@workspace/ui/money"
import { MoreHorizontalIcon } from "lucide-react"

type Props = {
  readonly accounts: readonly InvestmentAccountView[] | undefined
  readonly selectedAccountId?: string
  readonly isPending: boolean
  readonly isError: boolean
  readonly actionError?: string | null
  readonly actionPendingId?: string
  readonly onRetry: () => void
  readonly onCreate: () => void
  readonly onSelect: (accountId: string) => void
  readonly onConfigure: (account: InvestmentAccountView) => void
  readonly onArchive: (account: InvestmentAccountView) => void
  readonly onReactivate: (account: InvestmentAccountView) => void
}

const metrics = [
  { key: "ledgerBalanceMinor", label: "Saldo contábil" },
  { key: "positionCostMinor", label: "Custo alocado" },
  { key: "cashMinor", label: "Caixa da carteira" },
  { key: "marketValueMinor", label: "Valor avaliado" },
  { key: "unrealizedResultMinor", label: "Resultado não realizado" },
] as const

export function InvestmentAccountList({
  accounts,
  selectedAccountId,
  isPending,
  isError,
  actionError,
  actionPendingId,
  onRetry,
  onCreate,
  onSelect,
  onConfigure,
  onArchive,
  onReactivate,
}: Props) {
  if (isPending && accounts === undefined)
    return (
      <div
        aria-label="Carregando carteiras"
        className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2"
      >
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    )

  if (accounts === undefined)
    return (
      <ErrorState
        variant="load-error"
        title="Não foi possível carregar as carteiras"
        description="Os valores não foram substituídos por zero. Tente carregar novamente."
        actionLabel="Tentar novamente"
        onAction={onRetry}
      />
    )

  const negativeAccounts = accounts.filter(
    (account) => BigInt(account.cashMinor) < 0n
  )

  return (
    <section aria-label="Carteiras" className="flex min-w-0 flex-col gap-4">
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>
            Dados anteriores; atualização das carteiras falhou
          </AlertTitle>
          <AlertDescription>
            <Button variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Não foi possível atualizar a carteira</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {negativeAccounts.length > 0 && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            Valores calculados com inconsistências; revise saldos e aportes
          </AlertTitle>
          <AlertDescription>
            Saldo da carteira menor que o custo alocado; revise os registros.
          </AlertDescription>
        </Alert>
      )}
      {accounts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhuma carteira cadastrada.</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onCreate}>Cadastrar carteira</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
          {accounts.map((account) => {
            const pending = actionPendingId === account.id
            const negative = BigInt(account.cashMinor) < 0n
            return (
              <Card
                key={account.id}
                size="sm"
                data-testid={`investment-account-${account.id}`}
                className="min-w-0"
              >
                <CardHeader>
                  <CardTitle className="break-words">{account.name}</CardTitle>
                  <CardDescription>
                    {account.institutionName ?? "Instituição não informada"}
                    {account.displayReference
                      ? ` · ${account.displayReference}`
                      : ""}
                  </CardDescription>
                  <CardDescription>
                    {account.defaultSettlementAccountId
                      ? "Conta padrão de liquidação configurada"
                      : "Sem conta padrão de liquidação"}
                  </CardDescription>
                  <Badge
                    variant={
                      account.status === "ARCHIVED" ? "secondary" : "outline"
                    }
                  >
                    {account.status === "ARCHIVED" ? "Arquivada" : "Ativa"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    {metrics.map((metric) => (
                      <div key={metric.key} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">
                          {metric.label}
                        </dt>
                        <dd className="font-medium break-words tabular-nums">
                          {formatMinorAmount(
                            account[metric.key],
                            account.currency
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {negative && (
                    <p className="text-sm text-destructive">
                      Saldo da carteira menor que o custo alocado; revise os
                      registros.
                    </p>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button
                    variant={
                      selectedAccountId === account.id ? "secondary" : "outline"
                    }
                    aria-pressed={selectedAccountId === account.id}
                    onClick={() => onSelect(account.id)}
                  >
                    {selectedAccountId === account.id
                      ? "Carteira selecionada"
                      : "Ver carteira"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Ações de ${account.name}`}
                          disabled={pending}
                        />
                      }
                    >
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        {account.status === "ACTIVE" ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => onConfigure(account)}
                            >
                              Configurar carteira
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onArchive(account)}
                            >
                              Arquivar carteira
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => onReactivate(account)}
                          >
                            Reativar carteira
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
