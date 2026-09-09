import { PawPrint as LucidePawPrint } from "lucide-react"

import type { CategoryIconProps } from "./types"

export function PawPrint({
  size = 24,
  color = "currentColor",
  className,
  ...props
}: CategoryIconProps) {
  return (
    <LucidePawPrint
      size={size}
      color={color}
      className={className}
      {...props}
    />
  )
}
