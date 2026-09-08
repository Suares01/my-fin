import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { SearchIcon } from "lucide-react"
import type { TransactionFormOption } from "../hooks/use-transaction-form-options.js"
import type {
  TransactionFilters as TransactionFiltersState,
  TransactionType,
} from "../transaction-list-model.js"
import { Input } from "@workspace/ui/components/input"
import { useMemo } from "react"
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

type TransactionFiltersProps = {
  readonly filters: TransactionFiltersState
  readonly accounts: readonly TransactionFormOption[]
  readonly categories: readonly TransactionFormOption[]
  readonly onChange: (filters: TransactionFiltersState) => void
  readonly onReset: () => void
}

export function TransactionFilters({
  filters,
  categories,
  onChange,
}: TransactionFiltersProps) {
  const update = (patch: Partial<TransactionFiltersState>) =>
    onChange({ ...filters, ...patch })

  function onChangeSearch(event: React.ChangeEvent<HTMLInputElement>) {
    update({ search: event.currentTarget.value })
  }

  function onChangeCategories(value: string[]) {
    update({ categoryIds: value })
  }

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories]
  )
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
          placeholder="Search transactions..."
          value={filters.search}
          onChange={onChangeSearch}
          className="pl-8"
        />
      </div>

      {/* Category */}
      <Select
        items={categoryOptions}
        value={filters.categoryIds as string[]}
        onValueChange={onChangeCategories}
        multiple
      >
        <SelectTrigger>
          <SelectValue placeholder="Todas" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
    </section>
  )
}
