import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export function BookPageBackButton({
  onClick,
}: {
  readonly onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="touch-target mx-0 w-fit px-1"
      onClick={onClick}
      aria-label="Voltar para a tela anterior"
    >
      <ArrowLeft aria-hidden="true" />
      Voltar
    </Button>
  )
}
