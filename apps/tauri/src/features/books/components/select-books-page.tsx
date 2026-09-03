import { Skeleton } from "@workspace/ui/components/skeleton"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { BookPageBackButton } from "./book-page-back-button.js"
import { useBookRouteNavigation } from "../hooks/use-book-route-navigation.js"
import { useBookPageNavigation } from "../hooks/use-book-page-navigation.js"
import { useBooks } from "../hooks/use-books.js"
import { Button } from "@workspace/ui/components/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Link } from "react-router"

export function SelectBookPage() {
  const query = useBooks()
  const { session } = useActiveBook()
  const { activateAndOpenDashboard } = useBookRouteNavigation()
  const { canGoBack, goBack, navigationState } = useBookPageNavigation()

  if (query.isPending) {
    return (
      <section
        className="motion-reveal flex w-full max-w-2xl flex-col gap-6"
        aria-busy="true"
      >
        {canGoBack && <BookPageBackButton onClick={goBack} />}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-full max-w-lg" />
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </section>
    )
  }

  if (query.isError) {
    return (
      <section
        className="motion-reveal flex w-full max-w-2xl flex-col gap-6"
        aria-live="polite"
      >
        {canGoBack && <BookPageBackButton onClick={goBack} />}
        <PageIntro
          eyebrow="Seu ledger"
          title="Não foi possível carregar seus livros"
        />
        <Alert variant="destructive">
          <AlertTitle>O catálogo não respondeu</AlertTitle>
          <AlertDescription>
            Seus dados locais continuam preservados. Tente atualizar esta etapa.
          </AlertDescription>
        </Alert>
        <Button
          className="touch-target w-full sm:w-fit"
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </Button>
      </section>
    )
  }

  const books = query.data ?? []
  if (books.length === 0) {
    return (
      <Empty className="motion-reveal min-h-[22rem] border-0 px-0 py-10 text-left sm:items-start sm:text-left">
        {canGoBack && <BookPageBackButton onClick={goBack} />}
        <EmptyHeader className="items-start">
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Primeiro passo
          </p>
          <EmptyTitle className="font-display text-4xl font-normal tracking-tight">
            Seu dinheiro começa com um livro.
          </EmptyTitle>
          <EmptyDescription className="max-w-lg text-base">
            Um livro separa uma vida financeira da outra. Crie o primeiro para
            abrir suas contas e começar offline.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="items-start sm:max-w-none">
          <Button
            render={<Link to="/books/new" state={navigationState} />}
            nativeButton={false}
            className="touch-target w-full sm:w-fit"
          >
            Criar primeiro livro
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  if (books.length === 1) {
    return null
  }

  return (
    <section className="motion-reveal flex min-h-screen w-full flex-col justify-center gap-8 p-8">
      <div className="mx-auto mt-4 w-full border-none shadow-none md:max-w-3xl">
        {canGoBack && (
          <div className="my-4">
            <BookPageBackButton onClick={goBack} />
          </div>
        )}
        <PageIntro
          eyebrow="Escolha o contexto"
          title="Qual livro você quer abrir?"
          description="Cada lançamento fica no livro escolhido. A seleção permanece somente nesta sessão."
        />

        <table className="mt-8 w-full border-collapse">
          <thead>
            <tr className="h-12 border-b text-left text-sm text-foreground/80">
              <th className="font-semibold">Nome</th>
              <th className="text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book, index) => {
              const isActive =
                session.status === "ACTIVE" && session.bookId === book.id

              return (
                <tr
                  key={index}
                  className="h-20 border-b text-left text-sm text-foreground/40"
                >
                  <td className="text-lg font-light tracking-tight text-foreground lg:text-xl">
                    {book.name}
                  </td>
                  <td className="text-right text-foreground">
                    <Button
                      variant={isActive ? "outline" : "default"}
                      onClick={() => {
                        activateAndOpenDashboard(book.id)
                      }}
                    >
                      {isActive ? "Ativo" : "Selecionar"}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <p role="status" aria-live="polite" className="sr-only">
          {session.status === "ACTIVE"
            ? "Livro ativo selecionado."
            : "Escolha um livro para continuar."}
        </p>
      </div>
    </section>
  )
}

function PageIntro({
  eyebrow,
  title,
  description,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly description?: string
}) {
  return (
    <header className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h1 className="font-display text-4xl font-normal tracking-tight text-balance sm:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </header>
  )
}
