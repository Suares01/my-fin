import type { ReactElement } from "react"
import { ArrowLeftRight, Plus, TrendingDown, TrendingUp } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { TransactionCreateType } from "../hooks/use-transaction-create-drawer.js"

type TransactionCreateDropdownProps = {
  readonly onCreate: (type: TransactionCreateType) => void
  readonly children?: ReactElement
}

const transactionCreateOptions: ReadonlyArray<{
  readonly label: string
  readonly type: TransactionCreateType
  readonly Icon: typeof TrendingUp
}> = [
  { label: "Receita", type: "INCOME", Icon: TrendingUp },
  { label: "Despesa", type: "EXPENSE", Icon: TrendingDown },
  { label: "Transferência", type: "TRANSFER", Icon: ArrowLeftRight },
]

export function TransactionCreateDropdown({
  onCreate,
  children,
}: TransactionCreateDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          children ?? (
            <Button
              type="button"
              size="icon"
              aria-label="Criar transação"
              title="Criar transação"
            >
              <Plus aria-hidden="true" />
            </Button>
          )
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          {transactionCreateOptions.map(({ Icon, label, type }) => (
            <DropdownMenuItem key={type} onClick={() => onCreate(type)}>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
