import type { Control, FieldPathByValue } from "react-hook-form"
import { ControlledSelect } from "../../../components/forms/controlled-select"
import type { TransactionFormOption } from "../hooks/use-transaction-form-options"

export function TransactionAccountCategoryFields<
  TValues extends { accountId: string; categoryId: string },
  TOutput,
>({
  control,
  accounts,
  categories,
  disabled,
}: {
  readonly control: Control<TValues, unknown, TOutput>
  readonly accounts: readonly TransactionFormOption[]
  readonly categories: readonly TransactionFormOption[]
  readonly disabled: boolean
}) {
  return (
    <>
      <ControlledSelect
        control={control}
        name={"accountId" as FieldPathByValue<TValues, string>}
        label="Conta"
        options={accounts.map(({ id, name }) => ({ value: id, label: name }))}
        disabled={disabled}
      />
      <ControlledSelect
        control={control}
        name={"categoryId" as FieldPathByValue<TValues, string>}
        label="Categoria"
        options={categories.map(({ id, name }) => ({ value: id, label: name }))}
        disabled={disabled}
      />
    </>
  )
}
