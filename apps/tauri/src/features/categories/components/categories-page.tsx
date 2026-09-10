import type { CategorySummary } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { useEffect, useMemo, useRef, useState } from "react"
import { useActiveBook } from "../../../providers"
import { useCategories } from "../hooks"
import { AddCategoryCard } from "./add-category-card"
import { CategoryCard } from "./category-card"
import { CategoryForm } from "./category-form"
import {
  categoryStatusFilters,
  categoryTypeFilters,
  filterCategories,
  type CategoryStatusFilter,
  type CategoryTypeFilter,
} from "./category-list-model"
import {
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

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
  statusFilter,
  typeFilter,
  onStatusChange,
  onTypeChange,
}: {
  readonly statusFilter: CategoryStatusFilter
  readonly typeFilter: CategoryTypeFilter
  readonly onStatusChange: (filter: CategoryStatusFilter) => void
  readonly onTypeChange: (filter: CategoryTypeFilter) => void
}) {
  return (
    <div className="flex flex-col gap-3" aria-label="Filtros de categorias">
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Filtrar categorias por status"
      >
        <span className="sr-only text-sm font-medium">Status</span>
        <ToggleGroup
          value={[statusFilter]}
          aria-label="Filtrar categorias por status"
          onValueChange={(values) => {
            const value = values[0]
            if (value === "ACTIVE" || value === "ARCHIVED") {
              onStatusChange(value)
            }
          }}
        >
          {categoryStatusFilters.map((filter) => (
            <ToggleGroupItem key={filter.value} value={filter.value}>
              {filter.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Filtrar categorias por tipo"
      >
        <span className="sr-only text-sm font-medium">Tipo</span>
        <ToggleGroup
          value={[typeFilter]}
          aria-label="Filtrar categorias por tipo"
          onValueChange={(values) => {
            const value = values[0]
            if (value === "ALL" || value === "INCOME" || value === "EXPENSE") {
              onTypeChange(value)
            }
          }}
        >
          {categoryTypeFilters.map((filter) => (
            <ToggleGroupItem key={filter.value} value={filter.value}>
              {filter.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}

function EmptyCategoryFilter({
  statusFilter,
  typeFilter,
}: {
  readonly statusFilter: CategoryStatusFilter
  readonly typeFilter: CategoryTypeFilter
}) {
  const statusLabel = statusFilter === "ACTIVE" ? "ativa" : "arquivada"
  const typeLabel =
    typeFilter === "ALL"
      ? "categoria"
      : typeFilter === "INCOME"
        ? "categoria de receita"
        : "categoria de despesa"

  return (
    <div className="flex min-h-40 flex-col justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center sm:text-left">
      <p className="font-medium">
        Nenhuma {typeLabel} {statusLabel} foi encontrada.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Adicione uma categoria ou altere os filtros para continuar.
      </p>
    </div>
  )
}

export function CategoriesPage() {
  const { session } = useActiveBook()
  const query = useCategories(true)
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const [statusFilter, setStatusFilter] =
    useState<CategoryStatusFilter>("ACTIVE")
  const [typeFilter, setTypeFilter] = useState<CategoryTypeFilter>("ALL")
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [editingCategory, setEditingCategory] =
    useState<CategorySummary | null>(null)
  const createTriggerRef = useRef<HTMLButtonElement | null>(null)
  const editTriggerRef = useRef<HTMLElement | null>(null)
  const previousBookId = useRef(bookId)

  useEffect(() => {
    if (previousBookId.current !== bookId) {
      previousBookId.current = bookId
      setIsCreateDrawerOpen(false)
      setEditingCategory(null)
      setStatusFilter("ACTIVE")
      setTypeFilter("ALL")
    }
  }, [bookId])

  useEffect(() => {
    if (isCreateDrawerOpen || editingCategory !== null) return
    const trigger = createTriggerRef.current ?? editTriggerRef.current
    trigger?.focus()
    createTriggerRef.current = null
    editTriggerRef.current = null
  }, [editingCategory, isCreateDrawerOpen])

  const filteredCategories = useMemo(
    () => filterCategories(query.data ?? [], statusFilter, typeFilter),
    [query.data, statusFilter, typeFilter]
  )

  function openCreateDrawer(): void {
    createTriggerRef.current =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null
    setEditingCategory(null)
    setIsCreateDrawerOpen(true)
  }

  function openEditDrawer(category: CategorySummary): void {
    editTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setIsCreateDrawerOpen(false)
    setEditingCategory(category)
  }

  function closeCreateDrawer(open: boolean): void {
    setIsCreateDrawerOpen(open)
  }

  function closeEditDrawer(open: boolean): void {
    if (!open) setEditingCategory(null)
  }

  function handleSuccess(): void {
    setIsCreateDrawerOpen(false)
    setEditingCategory(null)
    void query.refetch()
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
        <CategorySheet
          mode="create"
          open={isCreateDrawerOpen}
          onOpenChange={closeCreateDrawer}
          onSuccess={handleSuccess}
        />
      </section>
    )
  }

  return (
    <section className="motion-reveal flex w-full flex-col gap-6">
      <PageIntro />
      <CategoryFilters
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onEdit={openEditDrawer}
          />
        ))}
        {filteredCategories.length === 0 && (
          <EmptyCategoryFilter
            statusFilter={statusFilter}
            typeFilter={typeFilter}
          />
        )}
        <AddCategoryCard onClick={openCreateDrawer} />
      </div>
      <CategorySheet
        mode="create"
        open={isCreateDrawerOpen}
        onOpenChange={closeCreateDrawer}
        onSuccess={handleSuccess}
      />
      <CategorySheet
        mode="edit"
        category={editingCategory ?? undefined}
        open={editingCategory !== null}
        onOpenChange={closeEditDrawer}
        onSuccess={handleSuccess}
      />
    </section>
  )
}

function CategorySheet({
  mode,
  category,
  open,
  onOpenChange,
  onSuccess,
}: {
  readonly mode: "create" | "edit"
  readonly category?: CategorySummary
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSuccess: () => void
}) {
  const isEdit = mode === "edit"

  return (
    <Drawer
      direction="right"
      modal={false}
      open={open}
      onOpenChange={onOpenChange}
    >
      {open && (
        <>
          <DrawerBackdrop data-slot="category-create-drawer-backdrop" />
          <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-xl">
            <DrawerHeader>
              <DrawerTitle>
                {isEdit ? "Editar categoria" : "Adicionar categoria"}
              </DrawerTitle>
              <DrawerDescription>
                {isEdit
                  ? "Atualize os dados visuais e o nome da categoria."
                  : "Registre uma categoria de receita ou despesa para organizar o livro ativo."}
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <CategoryForm
                mode={mode}
                initialCategory={category}
                onSuccess={onSuccess}
                onCancel={() => onOpenChange(false)}
              />
            </div>
          </DrawerContent>
        </>
      )}
    </Drawer>
  )
}

export default CategoriesPage
