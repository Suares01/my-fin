import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"

import { cn } from "@workspace/ui/lib/utils"

type ToggleGroupOrientation = "horizontal" | "vertical"

const ToggleGroupContext = React.createContext<{
  readonly orientation: ToggleGroupOrientation
}>({ orientation: "horizontal" })

function ToggleGroup({
  className,
  orientation = "horizontal",
  children,
  ...props
}: ToggleGroupPrimitive.Props & {
  readonly orientation?: ToggleGroupOrientation
}) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-orientation={orientation}
      className={cn(
        "flex w-fit items-center gap-2 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ orientation }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({ className, ...props }: TogglePrimitive.Props) {
  const { orientation } = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-4xl border border-border bg-background px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-primary-foreground",
        orientation === "vertical" && "w-full",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
