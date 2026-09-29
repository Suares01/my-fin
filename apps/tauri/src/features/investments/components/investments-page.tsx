import type {
  InvestmentInstrumentDto,
  InvestmentInstrumentView,
  InvestmentOperationHistoryItem,
  InvestmentPositionView,
} from "@workspace/application"
import { useQueryClient } from "@tanstack/react-query"
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
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ErrorState } from "@workspace/ui/components/error-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useEffect, useRef, useState } from "react"
import { AccountForm } from "../../accounts/components/account-form"
import type { FinancialAccountBalance } from "../../accounts/components/account-card"
import {
  useAccountBalances,
  useArchiveAccount,
  useReactivateAccount,
} from "../../accounts/hooks"
import { useActiveBook } from "../../../providers"
import {
  invalidateInvestmentQueries,
  useInvestmentAccounts,
  useInvestmentInstruments,
  useInvestmentPortfolio,
} from "../hooks"
import { InvestmentAmortizationForm } from "../forms/investment-amortization-form"
import { InvestmentCorrectionForm } from "../forms/investment-correction-form"
import { InvestmentExpenseForm } from "../forms/investment-expense-form"
import { InvestmentIncomeForm } from "../forms/investment-income-form"
import { InvestmentInstrumentForm } from "../forms/investment-instrument-form"
import { InvestmentPositionMetadataForm } from "../forms/investment-position-metadata-form"
import { InvestmentPurchaseForm } from "../forms/investment-purchase-form"
import { InvestmentSaleForm } from "../forms/investment-sale-form"
import { InvestmentValuationForm } from "../forms/investment-valuation-form"
import { OpenInvestmentPositionForm } from "../forms/open-investment-position-form"
import { InvestmentAccountList } from "./investment-account-list"
import {
  InvestmentPositionDetail,
  type InvestmentPositionAction,
} from "./investment-position-detail"
import { InvestmentPositionTable } from "./investment-position-table"
import { positionTerms } from "./investment-position-terms"
import { InvestmentPortfolioSummary } from "./investment-portfolio-summary"

type Props = {
  readonly positionId?: string
  readonly onNavigatePosition?: (positionId: string | null) => void
}

type PositionAction = Exclude<InvestmentPositionAction, "metadata"> | "metadata"
type DrawerAction =
  | { readonly kind: "create-wallet" }
  | { readonly kind: "edit-wallet"; readonly account: FinancialAccountBalance }
  | {
      readonly kind: "classify-wallet"
      readonly account: FinancialAccountBalance
    }
  | { readonly kind: "create-instrument" }
  | {
      readonly kind: "edit-instrument"
      readonly instrument: InvestmentInstrumentView
    }
  | { readonly kind: "open-position" }
  | { readonly kind: PositionAction; readonly position: InvestmentPositionView }
  | {
      readonly kind: "correct"
      readonly position: InvestmentPositionView
      readonly operation: InvestmentOperationHistoryItem
    }

const actionTitles: Record<DrawerAction["kind"], string> = {
  "create-wallet": "Cadastrar carteira",
  "edit-wallet": "Configurar carteira",
  "classify-wallet": "Classificar como carteira",
  "create-instrument": "Cadastrar instrumento",
  "edit-instrument": "Configurar instrumento",
  "open-position": "Novo investimento",
  purchase: "Comprar ou aplicar",
  sale: "Vender ou resgatar",
  income: "Registrar rendimento",
  amortization: "Registrar amortização",
  fee: "Registrar tarifa",
  tax: "Registrar imposto",
  valuation: "Registrar avaliação",
  metadata: "Editar rótulo",
  correct: "Corrigir operação",
}

export function InvestmentsPage({ positionId, onNavigatePosition }: Props) {
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const previousBookId = useRef(bookId)
  useEffect(() => {
    if (previousBookId.current !== bookId) {
      previousBookId.current = bookId
      onNavigatePosition?.(null)
    }
  }, [bookId, onNavigatePosition])

  if (bookId === null)
    return (
      <ErrorState
        variant="book-required"
        title="Selecione um livro para ver investimentos"
        description="As carteiras, posições e saldos pertencem ao livro ativo."
        actionLabel="Escolher livro"
        actionHref="/books"
      />
    )

  return (
    <InvestmentBookPage
      key={bookId}
      bookId={bookId}
      positionId={positionId}
      onNavigatePosition={onNavigatePosition}
    />
  )
}

function InvestmentBookPage({
  bookId,
  positionId,
  onNavigatePosition,
}: Props & { readonly bookId: string }) {
  const queryClient = useQueryClient()
  const summary = useInvestmentPortfolio()
  const accounts = useInvestmentAccounts()
  const instruments = useInvestmentInstruments()
  const balances = useAccountBalances(true)
  const archive = useArchiveAccount()
  const reactivate = useReactivateAccount()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  )
  const [localPositionId, setLocalPositionId] = useState<string | null>(null)
  const [action, setAction] = useState<DrawerAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [accountPendingId, setAccountPendingId] = useState<string | undefined>()
  const detailId = action === null ? (positionId ?? localPositionId) : null

  function navigatePosition(id: string | null): void {
    if (onNavigatePosition) onNavigatePosition(id)
    else setLocalPositionId(id)
  }
  function openAction(next: DrawerAction): void {
    navigatePosition(null)
    setAction(next)
  }
  async function finishAction(): Promise<void> {
    setAction(null)
    await invalidateInvestmentQueries(queryClient, bookId)
  }
  function accountBalance(id: string): FinancialAccountBalance | undefined {
    return balances.data?.find((item) => item.accountId === id) as
      | FinancialAccountBalance
      | undefined
  }
  async function changeAccountStatus(
    accountId: string,
    status: "ACTIVE" | "ARCHIVED"
  ): Promise<void> {
    const balance = accountBalance(accountId)
    if (balance?.version === undefined) {
      setActionError("Atualize a carteira antes de alterar seu estado.")
      return
    }
    setActionError(null)
    setAccountPendingId(accountId)
    try {
      const command = { bookId, accountId, expectedVersion: balance.version }
      if (status === "ARCHIVED") await archive.mutateAsync(command)
      else await reactivate.mutateAsync(command)
      await invalidateInvestmentQueries(queryClient, bookId)
      await balances.refetch()
    } catch {
      setActionError(
        "Não foi possível atualizar a carteira. Atualize os dados e tente novamente."
      )
    } finally {
      setAccountPendingId(undefined)
    }
  }
  function openPositionAction(
    kind: InvestmentPositionAction,
    selectedPosition: InvestmentPositionView
  ): void {
    openAction({ kind, position: selectedPosition })
  }
  const otherAssets =
    balances.data?.filter(
      (item) =>
        !item.archived &&
        item.accountKind === "ASSET" &&
        item.financialAccount?.type === "OTHER_ASSET"
    ) ?? []
  const settlementAccounts =
    balances.data
      ?.filter(
        (item) =>
          !item.archived &&
          item.financialAccount !== undefined &&
          ["BANK_ACCOUNT", "PAYMENT_ACCOUNT"].includes(
            item.financialAccount.type
          )
      )
      .map((item) => ({ id: item.accountId, name: item.accountName })) ?? []

  return (
    <section
      aria-label="Investimentos"
      className="motion-reveal flex min-w-0 flex-col gap-8"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Livro ativo
          </p>
          <h1 className="font-display text-4xl font-normal tracking-tight text-balance sm:text-5xl">
            Seus investimentos.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Carteiras e posições com valores contábeis e avaliações
            identificados separadamente.
          </p>
        </div>
        <Button onClick={() => openAction({ kind: "open-position" })}>
          Novo investimento
        </Button>
      </header>

      <InvestmentPortfolioSummary
        summary={summary.data}
        isPending={summary.isPending}
        isError={summary.isError}
        onRetry={() => void summary.refetch()}
        onCreateAccount={() => openAction({ kind: "create-wallet" })}
      />

      {otherAssets.length > 0 && (
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="font-heading text-xl font-medium">
              Contas a classificar
            </h2>
            <p className="text-sm text-muted-foreground">
              Outros ativos ficam fora do dinheiro disponível. Classifique a
              conta como carteira para usá-la em investimentos, sem gerar
              lançamentos.
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {otherAssets.map((account) => (
              <Card key={account.accountId} className="min-w-0">
                <CardHeader>
                  <CardTitle className="truncate text-base">
                    {account.accountName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-2">
                  <Button
                    variant="outline"
                    disabled={account.version === undefined}
                    onClick={() =>
                      openAction({
                        kind: "classify-wallet",
                        account: account as FinancialAccountBalance,
                      })
                    }
                  >
                    Classificar {account.accountName} como carteira
                  </Button>
                  {account.version === undefined && (
                    <p className="text-sm text-muted-foreground">
                      Atualize as contas antes de classificar.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-xl font-medium">Carteiras</h2>
          <Button
            variant="outline"
            onClick={() => openAction({ kind: "create-wallet" })}
          >
            Cadastrar carteira
          </Button>
        </div>
        <InvestmentAccountList
          accounts={accounts.data}
          selectedAccountId={selectedAccountId ?? undefined}
          isPending={accounts.isPending}
          isError={accounts.isError}
          actionError={actionError}
          actionPendingId={accountPendingId}
          onRetry={() => void accounts.refetch()}
          onCreate={() => openAction({ kind: "create-wallet" })}
          onSelect={(id) =>
            setSelectedAccountId((current) => (current === id ? null : id))
          }
          onConfigure={(account) => {
            const balance = accountBalance(account.id)
            if (balance === undefined || balance.version === undefined) {
              setActionError("Atualize a carteira antes de configurar.")
              return
            }
            openAction({ kind: "edit-wallet", account: balance })
          }}
          onArchive={(account) =>
            void changeAccountStatus(account.id, "ARCHIVED")
          }
          onReactivate={(account) =>
            void changeAccountStatus(account.id, "ACTIVE")
          }
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-xl font-medium">Instrumentos</h2>
          <Button
            variant="outline"
            onClick={() => openAction({ kind: "create-instrument" })}
          >
            Cadastrar instrumento
          </Button>
        </div>
        {instruments.isError && instruments.data !== undefined && (
          <Alert variant="destructive">
            <AlertTitle>
              Dados anteriores; atualização dos instrumentos falhou
            </AlertTitle>
            <AlertDescription>
              <Button
                variant="outline"
                onClick={() => void instruments.refetch()}
              >
                Recarregar instrumentos
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {instruments.isPending && instruments.data === undefined ? (
          <Skeleton aria-label="Carregando instrumentos" className="h-28" />
        ) : instruments.data === undefined ? (
          <ErrorState
            variant="load-error"
            title="Não foi possível carregar os instrumentos"
            actionLabel="Tentar novamente"
            onAction={() => void instruments.refetch()}
          />
        ) : instruments.data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhum instrumento cadastrado.</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => openAction({ kind: "create-instrument" })}>
                Cadastrar instrumento
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            {instruments.data.map((instrument) => (
              <Card key={instrument.id} size="sm" className="min-w-0">
                <CardHeader>
                  <CardTitle className="break-words">
                    {instrument.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{instrument.type}</Badge>
                    <Badge
                      variant={
                        instrument.status === "ACTIVE" ? "outline" : "secondary"
                      }
                    >
                      {instrument.status === "ACTIVE" ? "Ativo" : "Arquivado"}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      openAction({ kind: "edit-instrument", instrument })
                    }
                  >
                    Configurar {instrument.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <h2 className="font-heading text-xl font-medium">Posições</h2>
        {accounts.data === undefined || instruments.data === undefined ? (
          accounts.isError || instruments.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                Não foi possível carregar os cadastros das posições
              </AlertTitle>
              <AlertDescription>
                <Button
                  variant="outline"
                  onClick={() => {
                    void accounts.refetch()
                    void instruments.refetch()
                  }}
                >
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Skeleton aria-label="Carregando posições" className="h-72" />
          )
        ) : (
          <InvestmentPositionTable
            accounts={accounts.data}
            instruments={instruments.data}
            accountIdFilter={selectedAccountId}
            onAccountFilterChange={setSelectedAccountId}
            onCreate={() => openAction({ kind: "open-position" })}
            onView={(selected) => navigatePosition(selected.id)}
            onPurchase={(selected) => openPositionAction("purchase", selected)}
            onSale={(selected) => openPositionAction("sale", selected)}
            onEvaluate={(selected) => openPositionAction("valuation", selected)}
            onConfigure={(selected) => openPositionAction("metadata", selected)}
          />
        )}
      </div>

      <Drawer
        direction="right"
        modal={false}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) navigatePosition(null)
        }}
      >
        {detailId !== null && (
          <>
            <DrawerBackdrop />
            <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-2xl">
              <DrawerHeader>
                <DrawerTitle>Detalhe da posição</DrawerTitle>
                <DrawerDescription>
                  Termos, ações e históricos da posição selecionada.
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <InvestmentPositionDetail
                  positionId={detailId}
                  onAction={openPositionAction}
                  onCorrect={(operation, selected) =>
                    openAction({
                      kind: "correct",
                      position: selected,
                      operation,
                    })
                  }
                />
              </div>
            </DrawerContent>
          </>
        )}
      </Drawer>

      <Drawer
        direction="right"
        modal={false}
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null)
        }}
      >
        {action !== null && (
          <>
            <DrawerBackdrop />
            <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-2xl">
              <DrawerHeader>
                <DrawerTitle>{actionTitles[action.kind]}</DrawerTitle>
                <DrawerDescription>
                  Dados e prévia vinculados ao livro ativo.
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <ActionForm
                  action={action}
                  bookId={bookId}
                  settlementAccounts={settlementAccounts}
                  onSuccess={() => void finishAction()}
                  onCancel={() => setAction(null)}
                />
              </div>
            </DrawerContent>
          </>
        )}
      </Drawer>
    </section>
  )
}

function ActionForm({
  action,
  bookId,
  settlementAccounts,
  onSuccess,
  onCancel,
}: {
  readonly action: DrawerAction
  readonly bookId: string
  readonly settlementAccounts: readonly {
    readonly id: string
    readonly name: string
  }[]
  readonly onSuccess: () => void
  readonly onCancel: () => void
}) {
  switch (action.kind) {
    case "create-wallet":
      return (
        <AccountForm
          lockedType="INVESTMENT_ACCOUNT"
          settlementAccounts={settlementAccounts}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "edit-wallet":
    case "classify-wallet":
      return (
        <AccountForm
          mode="edit"
          lockedType="INVESTMENT_ACCOUNT"
          initialAccount={action.account}
          settlementAccounts={settlementAccounts.filter(
            (account) => account.id !== action.account.accountId
          )}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "create-instrument":
      return (
        <InvestmentInstrumentForm onSuccess={onSuccess} onCancel={onCancel} />
      )
    case "edit-instrument": {
      const initialInstrument: InvestmentInstrumentDto = {
        ...action.instrument,
        bookId,
      }
      return (
        <InvestmentInstrumentForm
          mode="edit"
          initialInstrument={initialInstrument}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    }
    case "open-position":
      return (
        <OpenInvestmentPositionForm onSuccess={onSuccess} onCancel={onCancel} />
      )
    case "purchase":
      return (
        <InvestmentPurchaseForm
          position={action.position}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "sale":
      return (
        <InvestmentSaleForm
          position={action.position}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "income":
      return (
        <InvestmentIncomeForm
          position={action.position}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "amortization":
      return (
        <InvestmentAmortizationForm
          position={action.position}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "fee":
    case "tax":
      return (
        <InvestmentExpenseForm
          position={action.position}
          initialType={action.kind === "tax" ? "TAX" : "FEE"}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "valuation":
      return (
        <InvestmentValuationForm
          position={action.position}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "metadata":
      return (
        <InvestmentPositionMetadataForm
          terms={positionTerms(action.position)}
          position={{
            id: action.position.id,
            bookId,
            version: action.position.version,
            ...(action.position.label === undefined
              ? {}
              : { label: action.position.label }),
          }}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
    case "correct":
      return (
        <InvestmentCorrectionForm
          position={action.position}
          operation={action.operation}
          lastEffectiveOperationId={action.operation.id}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )
  }
}
