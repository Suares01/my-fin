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
import { useCategories } from "../hooks"
import { AddCategoryCard } from "./add-category-card"
import { CategoryCard } from "./category-card"
import { CategoryForm } from "./category-form"
import {
  categoryFilters,
  filterCategories,
  type CategoryFilter,
} from "./category-list-model"

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
        Suas categorias.
      </h1>
      <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
        Organize cada entrada e saída para manter seus lançamentos claros no
        livro local.
      </p>
    </header>
  )
}

function CategoryFilters({
  selectedFilter,
  onChange,
}: {
  readonly selectedFilter: CategoryFilter
  readonly onChange: (filter: CategoryFilter) => void
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      aria-label="Filtrar categorias por tipo"
    >
      {categoryFilters.map((filter) => (
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

function EmptyCategoryFilter({ filter }: { readonly filter: CategoryFilter }) {
  const message =
    filter === "ALL"
      ? "Você ainda não tem categorias ativas."
      : `Nenhuma categoria de ${filter === "INCOME" ? "receita" : "despesa"} foi encontrada.`

  return (
    <div className="flex min-h-40 flex-col justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center sm:text-left">
      <p className="font-medium">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Adicione uma categoria ou altere o filtro para continuar.
      </p>
    </div>
  )
}

export function CategoriesPage() {
  const query = useCategories(false)
  const [selectedFilter, setSelectedFilter] = useState<CategoryFilter>("ALL")
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const filteredCategories = useMemo(
    () => filterCategories(query.data ?? [], "ACTIVE", selectedFilter),
    [query.data, selectedFilter]
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
        <div className="flex flex-col gap-4" aria-label="Carregando categorias">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
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
          <AlertTitle>Não foi possível carregar as categorias</AlertTitle>
          <AlertDescription>
            Suas categorias continuam preservadas. Tente atualizar esta etapa.
          </AlertDescription>
        </Alert>
        <Button
          className="touch-target w-full sm:w-fit"
          onClick={() => void query.refetch()}
        >
          Tentar carregar categorias novamente
        </Button>
        <div className="grid grid-cols-1 gap-4 sm:max-w-sm">
          <AddCategoryCard onClick={openCreateDrawer} />
        </div>
        <CreateCategoryDrawer
          open={isCreateDrawerOpen}
          onOpenChange={setIsCreateDrawerOpen}
        />
      </section>
    )
  }

  return (
    <section className="motion-reveal flex w-full max-w-6xl flex-col gap-6">
      <PageIntro />
      <CategoryFilters
        selectedFilter={selectedFilter}
        onChange={setSelectedFilter}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
        {filteredCategories.length === 0 && (
          <EmptyCategoryFilter filter={selectedFilter} />
        )}
        <AddCategoryCard onClick={openCreateDrawer} />
      </div>
      <CreateCategoryDrawer
        open={isCreateDrawerOpen}
        onOpenChange={setIsCreateDrawerOpen}
      />
    </section>
  )
}

function CreateCategoryDrawer({
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
          <SheetTitle>Adicionar categoria</SheetTitle>
          <SheetDescription>
            Registre uma categoria de receita ou despesa para organizar o livro
            ativo.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <CategoryForm
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default CategoriesPage
