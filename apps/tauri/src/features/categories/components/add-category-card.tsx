import { Plus } from "lucide-react"

type AddCategoryCardProps = {
  readonly onClick: () => void
}

export function AddCategoryCard({ onClick }: AddCategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card p-4 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Plus className="size-5" aria-hidden="true" />
      </span>
      <span className="text-sm font-medium">Adicionar categoria</span>
      <span className="text-center text-xs">
        Organize receitas e despesas do livro
      </span>
    </button>
  )
}
