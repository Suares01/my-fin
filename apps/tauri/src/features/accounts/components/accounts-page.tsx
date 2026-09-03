import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMemo, useState } from "react"
import { AddAccountCard } from "./add-account-card"
import { AccountCard } from "./account-card"
import { AccountForm } from "./account-form"
import { AccountSummary } from "./account-summary"
import { filterAccounts, type AccountFilter } from "./account-list-model"
import { useAccountBalances } from "../hooks"

const filters: ReadonlyArray<{
  readonly value: AccountFilter
  readonly label: string
}> = [
  { value: "ALL", label: "Todas" },
  { value: "ASSET", label: "Ativos" },
  { value: "LIABILITY", label: "Passivos" },
]

function PageIntroSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-5 w-full max-w-xl" />
    </div>
  )
}

function PageIntro() {
  return (
    <header className="flex flex-col gap-3">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Livro ativo
      </p>
      <h1 className="font-display text-4xl font-normal tracking-tight text-balance sm:text-5xl">
        Suas contas.
      </h1>
      <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
        Uma leitura calma da sua posição financeira, sempre derivada do ledger
        local.
      </p>
    </header>
  )
}

function AccountFilters({
  selectedFilter,
  onChange,
}: {
  readonly selectedFilter: AccountFilter
  readonly onChange: (filter: AccountFilter) => void
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      aria-label="Filtrar contas por tipo"
    >
      {filters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          aria-pressed={selectedFilter === filter.value}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            selectedFilter === filter.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}

function EmptyAccountFilter({ filter }: { readonly filter: AccountFilter }) {
  return (
    <div className="flex min-h-52 flex-col justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center sm:text-left">
      <p className="font-medium">
        {filter === "ALL"
          ? "Você ainda não tem contas financeiras."
          : `Nenhuma conta ${filter === "ASSET" ? "de ativo" : "de passivo"} foi encontrada.`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Adicione uma conta ou altere o filtro para continuar.
      </p>
    </div>
  )
}

export function AccountsPage() {
  const query = useAccountBalances(false)
  const [selectedFilter, setSelectedFilter] = useState<AccountFilter>("ALL")
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const accounts = useMemo(() => query.data ?? [], [query.data])
  const financialAccounts = useMemo(
    () => filterAccounts(accounts, "ALL"),
    [accounts]
  )
  const filteredAccounts = useMemo(
    () => filterAccounts(accounts, selectedFilter),
    [accounts, selectedFilter]
  )

  function openCreateDrawer(): void {
    setIsCreateDrawerOpen(true)
  }

  if (query.isPending) {
    return (
      <section
        className="motion-reveal flex w-full max-w-4xl flex-col gap-6"
        aria-busy="true"
      >
        <PageIntroSkeleton />
        <div className="flex flex-col gap-4" aria-label="Carregando contas">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </section>
    )
  }

  if (query.isError) {
    return (
      <section
        className="motion-reveal flex w-full max-w-6xl flex-col gap-6"
        aria-live="polite"
      >
        <PageIntro />
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar as contas</AlertTitle>
          <AlertDescription>
            Seus saldos continuam preservados. Tente atualizar esta etapa.
          </AlertDescription>
        </Alert>
        <Button
          className="touch-target w-full sm:w-fit"
          onClick={() => void query.refetch()}
        >
          Tentar carregar contas novamente
        </Button>
        <div className="grid grid-cols-1 gap-4 sm:max-w-sm">
          <AddAccountCard onClick={openCreateDrawer} />
        </div>
        <CreateAccountDrawer
          open={isCreateDrawerOpen}
          onOpenChange={setIsCreateDrawerOpen}
        />
      </section>
    )
  }

  return (
    <section className="motion-reveal flex w-full max-w-6xl flex-col gap-6">
      <PageIntro />
      <AccountSummary accounts={financialAccounts} />
      <AccountFilters
        selectedFilter={selectedFilter}
        onChange={setSelectedFilter}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAccounts.map((account) => (
          <AccountCard key={account.accountId} account={account} />
        ))}
        {filteredAccounts.length === 0 && (
          <EmptyAccountFilter filter={selectedFilter} />
        )}
        <AddAccountCard onClick={openCreateDrawer} />
      </div>
      <CreateAccountDrawer
        open={isCreateDrawerOpen}
        onOpenChange={setIsCreateDrawerOpen}
      />
    </section>
  )
}

function CreateAccountDrawer({
  open,
  onOpenChange,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Adicionar conta</SheetTitle>
          <SheetDescription>
            Registre uma conta financeira para acompanhar seu saldo no livro
            ativo.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <AccountForm
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
