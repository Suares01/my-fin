import type { CategorySummary } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Archive, CircleArrowDown, CircleArrowUp } from "lucide-react"
import { useState } from "react"
import { useActiveBook } from "../../../providers"
import { useArchiveCategory } from "../hooks"

const categoryAppearance = {
  INCOME: {
    label: "Receita",
    description: "Categoria de receita",
    accent: "bg-emerald-500",
    icon: CircleArrowUp,
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  EXPENSE: {
    label: "Despesa",
    description: "Categoria de despesa",
    accent: "bg-rose-500",
    icon: CircleArrowDown,
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
} as const

type CategoryCardProps = {
  readonly category: CategorySummary
}

function archiveErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined

  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "Esta categoria foi alterada. Atualize a lista e tente novamente."
    case "SYSTEM_ACCOUNT_PROTECTED":
      return "Categorias do sistema não podem ser arquivadas."
    case "ENTITY_NOT_FOUND":
      return "Esta categoria não está mais disponível. Atualize a lista."
    default:
      return "Não foi possível arquivar a categoria. Tente novamente."
  }
}

export function CategoryCard({ category }: CategoryCardProps) {
  const { session } = useActiveBook()
  const archive = useArchiveCategory()
  const [archiveError, setArchiveError] = useState<unknown>(null)
  const appearance = categoryAppearance[category.kind]
  const Icon = appearance.icon
  const activeBookId = session.status === "ACTIVE" ? session.bookId : null

  async function archiveCategory(): Promise<void> {
    if (activeBookId === null) return

    try {
      setArchiveError(null)
      await archive.mutateAsync({
        bookId: activeBookId,
        accountId: category.id,
        expectedVersion: category.version,
      })
    } catch (error) {
      setArchiveError(error)
    }
  }

  return (
    <article className="group relative flex min-h-40 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
      <div className={`absolute inset-y-0 left-0 w-1 ${appearance.accent}`} />
      <div className="flex flex-1 flex-col justify-between p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-muted">
              <Icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {appearance.description}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="touch-target size-9 text-muted-foreground hover:text-destructive"
            aria-label={`Arquivar ${category.name}`}
            title="Arquivar categoria"
            disabled={activeBookId === null || archive.isPending}
            onClick={() => void archiveCategory()}
          >
            <Archive className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-6">
          <h2 className="truncate text-sm font-semibold">{category.name}</h2>
          <span
            className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${appearance.badge}`}
          >
            {appearance.label}
          </span>
        </div>
      </div>
      {archiveError !== null && (
        <Alert variant="destructive" className="mx-4 mb-4">
          <AlertTitle>Não foi possível arquivar</AlertTitle>
          <AlertDescription>
            {archiveErrorMessage(archiveError)}
          </AlertDescription>
        </Alert>
      )}
    </article>
  )
}
