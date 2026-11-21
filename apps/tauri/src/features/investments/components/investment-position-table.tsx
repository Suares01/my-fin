import type {
  InvestmentAccountView,
  InvestmentInstrumentView,
  InvestmentPositionView,
} from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { formatMinorAmount } from "@workspace/ui/money"
import { MoreHorizontalIcon, SearchIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { useInvestmentPositions } from "../hooks"

type Props = {
  readonly accounts: readonly InvestmentAccountView[]
  readonly accountIdFilter?: string | null
  readonly onAccountFilterChange?: (accountId: string | null) => void
  readonly instruments: readonly InvestmentInstrumentView[]
  readonly onCreate: () => void
  readonly onView: (position: InvestmentPositionView) => void
  readonly onPurchase: (position: InvestmentPositionView) => void
  readonly onSale: (position: InvestmentPositionView) => void
  readonly onEvaluate: (position: InvestmentPositionView) => void
  readonly onConfigure: (position: InvestmentPositionView) => void
}

const assetClasses = [
  { value: "FIXED_INCOME", label: "Renda fixa" },
  { value: "EQUITY", label: "Ações" },
  { value: "FUND", label: "Fundos" },
  { value: "PENSION", label: "Previdência" },
  { value: "STRUCTURED", label: "Estruturados" },
  { value: "CRYPTO", label: "Criptoativos" },
  { value: "OTHER", label: "Outros" },
] as const

function date(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-")
  return `${day}/${month}/${year}`
}

function PositionFilter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly options: readonly {
    readonly value: string
    readonly label: string
  }[]
  readonly onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => onChange(next ?? "ALL")}
        modal={false}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function MobileLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-muted-foreground xl:hidden">
      {children}
    </span>
  )
}

export function InvestmentPositionTable({
  accounts,
  accountIdFilter,
  onAccountFilterChange,
  instruments,
  onCreate,
  onView,
  onPurchase,
  onSale,
  onEvaluate,
  onConfigure,
}: Props) {
  const [localAccountId, setLocalAccountId] = useState("ALL")
  const accountId =
    accountIdFilter === undefined ? localAccountId : (accountIdFilter ?? "ALL")
  const setAccountId = (next: string) => {
    setLocalAccountId(next)
    onAccountFilterChange?.(next === "ALL" ? null : next)
  }
  const [assetClass, setAssetClass] = useState("ALL")
  const [status, setStatus] = useState("ALL")
  const [search, setSearch] = useState("")
  const filters = {
    ...(accountId === "ALL" ? {} : { accountId }),
    ...(assetClass === "ALL" ? {} : { assetClass }),
    status: status as "OPEN" | "CLOSED" | "ALL",
    search,
  }
  const query = useInvestmentPositions(filters)
  const positions = query.data?.items
  const filtered =
    accountId !== "ALL" ||
    assetClass !== "ALL" ||
    status !== "ALL" ||
    search.trim().length > 0
  const activeFilterCount = [
    accountId !== "ALL",
    assetClass !== "ALL",
    status !== "ALL",
    search.trim().length > 0,
  ].filter(Boolean).length
  const names = new Map(accounts.map((account) => [account.id, account.name]))
  const activeAccounts = new Set(
    accounts
      .filter((account) => account.status === "ACTIVE")
      .map((account) => account.id)
  )
  const activeInstruments = new Set(
    instruments
      .filter((instrument) => instrument.status === "ACTIVE")
      .map((instrument) => instrument.id)
  )
  const money = (minor: string, currency: string) =>
    formatMinorAmount(minor, currency)
  const signedMoney = (minor: string, currency: string) =>
    `${BigInt(minor) > 0n ? "+" : ""}${money(minor, currency)}`

  function clearFilters(): void {
    setAccountId("ALL")
    setAssetClass("ALL")
    setStatus("ALL")
    setSearch("")
  }

  return (
    <section
      aria-label="Posições de investimento"
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="rounded-2xl border bg-muted/25 p-4">
        <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,2fr)_repeat(3,minmax(9rem,1fr))]">
          <Field className="sm:col-span-2 xl:col-span-1">
            <FieldLabel htmlFor="position-search">Nome ou rótulo</FieldLabel>
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="position-search"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar posições"
              />
            </div>
          </Field>
          <PositionFilter
            id="position-account-filter"
            label="Carteira"
            value={accountId}
            options={[
              { value: "ALL", label: "Todas as carteiras" },
              ...accounts.map((account) => ({
                value: account.id,
                label: account.name,
              })),
            ]}
            onChange={setAccountId}
          />
          <PositionFilter
            id="position-class-filter"
            label="Classe"
            value={assetClass}
            options={[
              { value: "ALL", label: "Todas as classes" },
              ...assetClasses,
            ]}
            onChange={setAssetClass}
          />
          <PositionFilter
            id="position-status-filter"
            label="Estado"
            value={status}
            options={[
              { value: "ALL", label: "Todos os estados" },
              { value: "OPEN", label: "Abertas" },
              { value: "CLOSED", label: "Encerradas" },
            ]}
            onChange={setStatus}
          />
        </FieldGroup>
        {activeFilterCount > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-sm text-muted-foreground">
              {activeFilterCount}{" "}
              {activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon aria-hidden="true" />
              Limpar todos os filtros
            </Button>
          </div>
        )}
      </div>

      {query.isError && positions !== undefined && (
        <Alert variant="destructive">
          <AlertTitle>
            Dados anteriores; atualização das posições falhou
          </AlertTitle>
          <AlertDescription>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {query.isPending && positions === undefined ? (
        <div
          aria-label="Carregando posições"
          aria-busy="true"
          className="flex flex-col gap-2"
        >
          <Skeleton className="h-24 rounded-2xl xl:h-14" />
          <Skeleton className="h-24 rounded-2xl xl:h-14" />
        </div>
      ) : positions === undefined ? (
        <ErrorState
          variant="load-error"
          title="Não foi possível carregar as posições"
          description="As posições não foram substituídas por uma lista vazia."
          actionLabel="Tentar novamente"
          onAction={() => void query.refetch()}
        />
      ) : positions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {filtered
                ? "Nenhuma posição corresponde aos filtros."
                : "Nenhuma posição cadastrada."}
            </EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            {filtered ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={onCreate}>Abrir posição</Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div
            className="min-w-0 xl:overflow-hidden xl:rounded-2xl xl:border xl:bg-card"
            aria-label="Lista responsiva de posições"
            data-layout="responsive"
          >
            <Table className="block min-w-0 xl:table">
              <TableHeader className="hidden bg-muted/40 xl:table-header-group">
                <TableRow>
                  <TableHead className="w-[32%] whitespace-normal">
                    Investimento
                  </TableHead>
                  <TableHead className="whitespace-normal">
                    Quantidade
                  </TableHead>
                  <TableHead className="whitespace-normal">Custo</TableHead>
                  <TableHead className="whitespace-normal">
                    Valor atual
                  </TableHead>
                  <TableHead className="whitespace-normal">Resultado</TableHead>
                  <TableHead className="w-16 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="block space-y-3 xl:table-row-group xl:space-y-0">
                {positions.map((position) => {
                  const tradable =
                    position.status === "OPEN" &&
                    activeAccounts.has(position.investmentAccountId) &&
                    activeInstruments.has(position.instrumentId)
                  const valuation = position.valuation
                  const classLabel =
                    assetClasses.find(
                      (item) => item.value === position.assetClass
                    )?.label ?? position.assetClass
                  const resultMinor =
                    valuation.basis === "VALUATION" &&
                    position.status === "OPEN"
                      ? (
                          BigInt(valuation.currentValueMinor) -
                          BigInt(position.bookCostMinor)
                        ).toString()
                      : null

                  return (
                    <TableRow
                      key={position.id}
                      data-testid={`position-${position.id}`}
                      className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border bg-card p-4 hover:bg-muted/30 xl:table-row xl:rounded-none xl:border-x-0 xl:bg-transparent xl:p-0"
                    >
                      <TableCell className="col-span-2 block p-0 whitespace-normal xl:table-cell xl:p-3">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="font-semibold break-words">
                              {position.instrumentName}
                            </span>
                            <Badge variant="secondary">{classLabel}</Badge>
                            <Badge
                              variant={
                                position.status === "OPEN"
                                  ? "outline"
                                  : "secondary"
                              }
                            >
                              {position.status === "OPEN"
                                ? "Aberta"
                                : "Encerrada"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-xs leading-relaxed text-muted-foreground">
                            <span>{position.label ?? "Sem rótulo"}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {names.get(position.investmentAccountId) ??
                                "Carteira indisponível"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="block p-0 whitespace-normal xl:table-cell xl:p-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <MobileLabel>Quantidade</MobileLabel>
                          <span className="break-words tabular-nums">
                            {position.quantity ?? "Desconhecida"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="block p-0 whitespace-normal xl:table-cell xl:p-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <MobileLabel>Custo</MobileLabel>
                          <span className="break-words tabular-nums">
                            {money(position.bookCostMinor, position.currency)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="block p-0 whitespace-normal xl:table-cell xl:p-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <MobileLabel>Valor atual</MobileLabel>
                          <span className="font-medium break-words tabular-nums">
                            {money(
                              valuation.currentValueMinor,
                              position.currency
                            )}
                          </span>
                          <span className="text-xs leading-relaxed text-muted-foreground">
                            {valuation.basis === "VALUATION"
                              ? `Avaliação de ${valuation.valuedAt ? date(valuation.valuedAt) : "data desconhecida"}`
                              : valuation.basis === "BOOK_COST"
                                ? "Sem avaliação atual; usando custo"
                                : "Posição encerrada"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="block p-0 whitespace-normal xl:table-cell xl:p-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <MobileLabel>Resultado</MobileLabel>
                          {resultMinor === null ? (
                            <span className="text-sm text-muted-foreground">
                              {valuation.basis === "BOOK_COST"
                                ? "Resultado indisponível"
                                : "—"}
                            </span>
                          ) : (
                            <span className="font-medium break-words tabular-nums">
                              {signedMoney(resultMinor, position.currency)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="col-span-2 block p-0 text-right xl:table-cell xl:p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={`Ações da posição ${position.instrumentName} — ${position.label ?? position.id}`}
                              />
                            }
                          >
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => onView(position)}
                              >
                                Ver detalhes
                              </DropdownMenuItem>
                              {tradable && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => onPurchase(position)}
                                  >
                                    Comprar ou aplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => onSale(position)}
                                  >
                                    Vender ou resgatar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => onEvaluate(position)}
                                  >
                                    Avaliar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => onConfigure(position)}
                                  >
                                    Configurar posição
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage
                ? "Carregando mais..."
                : "Carregar mais"}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
