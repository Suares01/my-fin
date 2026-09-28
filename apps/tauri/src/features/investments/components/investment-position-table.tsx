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
import { MoreHorizontalIcon } from "lucide-react"
import { useState } from "react"
import { useInvestmentPositions } from "../hooks"

type Props = {
  readonly accounts: readonly InvestmentAccountView[]
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

export function InvestmentPositionTable({
  accounts,
  instruments,
  onCreate,
  onView,
  onPurchase,
  onSale,
  onEvaluate,
  onConfigure,
}: Props) {
  const [accountId, setAccountId] = useState("ALL")
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
      <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <Field>
          <FieldLabel htmlFor="position-search">Nome ou rótulo</FieldLabel>
          <Input
            id="position-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar posições"
          />
        </Field>
      </FieldGroup>

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
        <div aria-label="Carregando posições" className="flex flex-col gap-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
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
            className="max-w-full min-w-0"
            aria-label="Tabela com rolagem horizontal"
          >
            <Table className="min-w-240">
              <TableHeader>
                <TableRow>
                  <TableHead>Instrumento</TableHead>
                  <TableHead>Carteira</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Valor atual</TableHead>
                  <TableHead>Base da avaliação</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => {
                  const tradable =
                    position.status === "OPEN" &&
                    activeAccounts.has(position.investmentAccountId) &&
                    activeInstruments.has(position.instrumentId)
                  const valuation = position.valuation
                  return (
                    <TableRow
                      key={position.id}
                      data-testid={`position-${position.id}`}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {position.instrumentName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {position.label ?? "Sem rótulo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {names.get(position.investmentAccountId) ??
                          "Carteira indisponível"}
                      </TableCell>
                      <TableCell>
                        {assetClasses.find(
                          (item) => item.value === position.assetClass
                        )?.label ?? position.assetClass}
                      </TableCell>
                      <TableCell>
                        {position.quantity ?? "Desconhecida"}
                      </TableCell>
                      <TableCell>
                        {money(position.bookCostMinor, position.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>
                            {money(
                              valuation.currentValueMinor,
                              position.currency
                            )}
                          </span>
                          {position.status === "OPEN" && (
                            <span className="text-xs text-muted-foreground">
                              Líquido:{" "}
                              {valuation.netValueMinor === undefined
                                ? "desconhecido"
                                : money(
                                    valuation.netValueMinor,
                                    position.currency
                                  )}
                              ; resgatável:{" "}
                              {valuation.withdrawableValueMinor === undefined
                                ? "desconhecido"
                                : money(
                                    valuation.withdrawableValueMinor,
                                    position.currency
                                  )}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {valuation.basis === "VALUATION"
                          ? `Avaliação de ${valuation.valuedAt ? date(valuation.valuedAt) : "data desconhecida"}`
                          : valuation.basis === "BOOK_COST"
                            ? "Sem avaliação atual; usando custo"
                            : "Posição encerrada"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            position.status === "OPEN" ? "outline" : "secondary"
                          }
                        >
                          {position.status === "OPEN" ? "Aberta" : "Encerrada"}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
