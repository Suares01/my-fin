import { FinancialBookSummary } from "@workspace/application"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Badge } from "lucide-react"

type BookOptionCardProps = {
  readonly book: FinancialBookSummary
  readonly active?: boolean
  readonly disabled?: boolean
  readonly onSelect: (bookId: string) => void
}

export function BookOptionCard({
  book,
  active = false,
  disabled = false,
  onSelect,
}: BookOptionCardProps) {
  return (
    <Card
      data-book-id={book.id}
      data-selected={active ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      className="border-border/70 bg-card/70 shadow-none transition-[border-color,background-color] data-[selected=true]:border-primary/50 data-[selected=true]:bg-secondary/60"
    >
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="min-w-0 truncate text-base">
            {book.name}
          </CardTitle>
          {active && <Badge>Livro ativo</Badge>}
        </div>
        <CardDescription>
          Este contexto permanece local e separado dos outros livros.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Badge>{book.baseCurrency}</Badge>
        <Badge>{book.timezone}</Badge>
      </CardContent>
      <CardFooter className="justify-end gap-2 border-0 bg-transparent p-(--card-spacing)">
        <Button
          type="button"
          variant={active ? "secondary" : "outline"}
          className="touch-target w-full sm:w-auto"
          aria-label={
            active ? `${book.name}, livro selecionado` : `Abrir ${book.name}`
          }
          aria-pressed={active}
          disabled={disabled}
          onClick={() => onSelect(book.id)}
        >
          {active ? "Livro selecionado" : "Abrir livro"}
        </Button>
      </CardFooter>
    </Card>
  )
}
