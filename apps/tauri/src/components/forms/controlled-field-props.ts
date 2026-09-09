import type { ReactNode } from "react"
import type { Control, FieldPathByValue, FieldValues } from "react-hook-form"

export type ControlledFieldProps<
  TValues extends FieldValues,
  TValue,
  TOutput = TValues,
> = {
  readonly control: Control<TValues, unknown, TOutput>
  readonly name: FieldPathByValue<TValues, TValue>
  readonly label: string
  readonly description?: ReactNode
  readonly disabled?: boolean
}
