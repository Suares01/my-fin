import type { CategorySummary } from "@workspace/application"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Archive, Pencil, RefreshCcw } from "lucide-react"
import { createElement } from "react"
import { toast } from "@workspace/ui/components/toast"
import { getCategoryIconOrFallback } from "../../../components/category-icons"
import { useActiveBook } from "../../../providers"
import { useArchiveCategory, useReactivateCategory } from "../hooks"

type CategoryCardProps = {
  readonly category: CategorySummary
  readonly onEdit?: (category: CategorySummary) => void
}

function lifecycleErrorMessage(
  error: unknown,
  action: "arquivar" | "reativar"
): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined

  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "Esta categoria foi alterada. Atualize a lista e tente novamente."
    case "SYSTEM_ACCOUNT_PROTECTED":
      return "Categorias do sistema não podem ser alteradas."
    case "ENTITY_NOT_FOUND":
      return "Esta categoria não está mais disponível. Atualize a lista."
    default:
      return `Não foi possível ${action} a categoria. Tente novamente.`
  }
}

export function CategoryCard({ category, onEdit }: CategoryCardProps) {
  const { session } = useActiveBook()
  const archive = useArchiveCategory()
  const reactivate = useReactivateCategory()
  const Icon = getCategoryIconOrFallback(category.iconKey)
  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const pending = archive.isPending || reactivate.isPending
  const disabled = activeBookId === null || pending
  const color = category.colorHex ? `#${category.colorHex}` : "#64748b"
  const isArchived = category.status === "ARCHIVED"
  const action = isArchived ? "reativar" : "arquivar"

  async function runLifecycleAction(): Promise<void> {
    if (activeBookId === null) return

    try {
      const result = isArchived
        ? await reactivate.mutateAsync({
            bookId: activeBookId,
            categoryId: category.id,
            expectedVersion: category.version,
          })
        : await archive.mutateAsync({
            bookId: activeBookId,
            categoryId: category.id,
            expectedVersion: category.version,
          })

      if (result.refreshWarning) {
        toast.add({
          type: "warning",
          title: "Categoria atualizada",
          description: "Atualize os dados para ver a lista mais recente.",
        })
      }
    } catch (error) {
      toast.add({
        type: "error",
        title: `Não foi possível ${action} a categoria`,
        description: lifecycleErrorMessage(error, action),
      })
    }
  }

  return (
    <article className="group relative flex min-h-40 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
      <div
        aria-hidden="true"
        data-category-accent="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
      />
      <div className="flex flex-1 flex-col justify-between p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="flex size-8 items-center justify-center rounded-full bg-muted"
              data-category-icon="true"
              style={{ color }}
            >
              {createElement(Icon, {
                "aria-hidden": true,
                className: "size-4",
              })}
            </div>
            <span className="text-xs text-muted-foreground">
              {category.kind === "INCOME"
                ? "Categoria de receita"
                : "Categoria de despesa"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="touch-target size-9 text-muted-foreground"
              aria-label={`Editar ${category.name}`}
              title="Editar categoria"
              disabled={disabled}
              onClick={() => onEdit?.(category)}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="touch-target size-9 text-muted-foreground hover:text-destructive"
              aria-label={`${isArchived ? "Reativar" : "Arquivar"} ${category.name}`}
              title={`${isArchived ? "Reativar" : "Arquivar"} categoria`}
              disabled={disabled}
              onClick={() => void runLifecycleAction()}
            >
              {isArchived ? (
                <RefreshCcw className="size-4" aria-hidden="true" />
              ) : (
                <Archive className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="truncate text-sm font-semibold">{category.name}</h2>
          <Badge variant="outline" className="mt-2">
            {category.kind === "INCOME" ? "Receita" : "Despesa"}
          </Badge>
        </div>
      </div>
    </article>
  )
}
