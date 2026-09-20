import { Button } from "@workspace/ui/components/button"
import { SearchIcon } from "lucide-react"
import type { TransactionFormOption } from "../hooks/use-transaction-form-options.js"
import type {
  TransactionFilters as TransactionFiltersState,
  TransactionStatusFilter,
  TransactionType,
} from "../transaction-list-model.js"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

const ALL_TRANSACTION_TYPES = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
] as const satisfies readonly TransactionType[]

// eslint-disable-next-line react-refresh/only-export-components
export const emptyTransactionFilters: TransactionFiltersState = {
  from: "",
  to: "",
  search: "",
  types: ALL_TRANSACTION_TYPES,
  accountIds: [],
  categoryIds: [],
  status: "ALL",
}

const typeLabels: ReadonlyArray<{ value: TransactionType; label: string }> = [
  { value: "INCOME", label: "Receita" },
  { value: "EXPENSE", label: "Despesa" },
  { value: "TRANSFER", label: "Transferência" },
]

const statusLabels: ReadonlyArray<{
  value: TransactionStatusFilter
  label: string
}> = [
  { value: "ALL", label: "Todos os status" },
  { value: "ACTIVE", label: "Ativa" },
  { value: "EDITED", label: "Editada" },
  { value: "CANCELLED", label: "Cancelada" },
]

type TransactionFiltersProps = {
  readonly filters: TransactionFiltersState
  readonly accounts: readonly TransactionFormOption[]
  readonly categories: readonly TransactionFormOption[]
  readonly onChange: (filters: TransactionFiltersState) => void
  readonly onReset: () => void
}

export function TransactionFilters({
  filters,
  accounts,
  categories,
  onChange,
  onReset,
}: TransactionFiltersProps) {
  const update = (patch: Partial<TransactionFiltersState>) =>
    onChange({ ...filters, ...patch })

  function onChangeSearch(event: React.ChangeEvent<HTMLInputElement>) {
    update({ search: event.currentTarget.value })
  }

  const selectedType = ALL_TRANSACTION_TYPES.every((type) =>
    filters.types.includes(type)
  )
    ? "ALL"
    : filters.types.length === 1
      ? filters.types[0]
      : undefined

  return (
    <section className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative w-full sm:min-w-[200px] sm:flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar"
          type="search"
          placeholder="Buscar transações..."
          value={filters.search}
          onChange={onChangeSearch}
          className="pl-8"
        />
      </div>

      <Input
        aria-label="De"
        type="date"
        value={filters.from}
        onChange={(event) => update({ from: event.currentTarget.value })}
      />

      <Input
        aria-label="Até"
        type="date"
        value={filters.to}
        onChange={(event) => update({ to: event.currentTarget.value })}
      />

      <select
        aria-label="Conta"
        value={filters.accountIds[0] ?? ""}
        onChange={(event) =>
          update({
            accountIds: event.currentTarget.value
              ? [event.currentTarget.value]
              : [],
          })
        }
      >
        <option value="">Todas as contas</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>

      {/* Category */}
      <select
        aria-label="Categoria"
        value={filters.categoryIds[0] ?? ""}
        onChange={(event) =>
          update({
            categoryIds: event.currentTarget.value
              ? [event.currentTarget.value]
              : [],
          })
        }
      >
        <option value="">Todas as categorias</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      {/* Type Toggle */}
      <div className="flex items-center rounded-lg border border-border p-0.5">
        <button
          type="button"
          onClick={() => update({ types: ALL_TRANSACTION_TYPES })}
          aria-pressed={selectedType === "ALL"}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
            selectedType === "ALL"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Todos
        </button>
        {typeLabels.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => update({ types: [opt.value] })}
            aria-pressed={selectedType === opt.value}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
              selectedType === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <select
        aria-label="Status"
        value={filters.status}
        onChange={(event) =>
          update({
            status: event.currentTarget.value as TransactionStatusFilter,
          })
        }
      >
        {statusLabels.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <p role="status" className="text-sm text-muted-foreground">
        O status filtra somente os resultados carregados.
      </p>

      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={onReset}
      >
        Limpar filtros
      </Button>
    </section>
  )
}
