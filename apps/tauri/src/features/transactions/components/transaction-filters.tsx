import { Button } from "@workspace/ui/components/button"
import { Search } from "lucide-react"
import type { TransactionFormOption } from "../hooks/use-transaction-form-options.js"
import type {
  TransactionFilters as TransactionFiltersState,
  TransactionStatusFilter,
  TransactionType,
} from "../transaction-list-model.js"

// eslint-disable-next-line react-refresh/only-export-components
export const emptyTransactionFilters: TransactionFiltersState = {
  from: "",
  to: "",
  search: "",
  types: ["INCOME", "EXPENSE", "TRANSFER"],
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

function nextTypes(
  types: readonly TransactionType[],
  type: TransactionType,
  checked: boolean
): readonly TransactionType[] {
  return checked
    ? [...new Set([...types, type])]
    : types.filter((value) => value !== type)
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

  return (
    <section
      className="rounded-xl border border-border p-4"
      aria-label="Filtros de transações"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Buscar
          <span className="relative">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              className="w-full rounded-md border border-input bg-background py-2 pr-3 pl-9"
              value={filters.search}
              onChange={(event) =>
                update({ search: event.currentTarget.value })
              }
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          De
          <input
            type="date"
            className="w-full rounded-md border border-input bg-background p-2"
            value={filters.from}
            onChange={(event) => update({ from: event.currentTarget.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Até
          <input
            type="date"
            className="w-full rounded-md border border-input bg-background p-2"
            value={filters.to}
            onChange={(event) => update({ to: event.currentTarget.value })}
          />
        </label>
        <fieldset className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          <legend>Tipo</legend>
          <div className="flex flex-wrap gap-3">
            {typeLabels.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-1.5 font-normal"
              >
                <input
                  type="checkbox"
                  checked={filters.types.includes(value)}
                  onChange={(event) =>
                    update({
                      types: nextTypes(
                        filters.types,
                        value,
                        event.currentTarget.checked
                      ),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Conta
          <select
            className="w-full rounded-md border border-input bg-background p-2"
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
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Categoria
          <select
            className="w-full rounded-md border border-input bg-background p-2"
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
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select
            className="w-full rounded-md border border-input bg-background p-2"
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
        </label>
      </div>
      <p className="mt-3 text-sm text-muted-foreground" role="status">
        O status filtra somente os resultados carregados.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full sm:w-auto"
        onClick={onReset}
      >
        Limpar filtros
      </Button>
    </section>
  )
}
