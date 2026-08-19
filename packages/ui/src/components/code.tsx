import * as React from "react"
import { cn } from "../lib/utils"

function Code({ className, ...props }: React.ComponentProps<"code">) {
  return (
    <code
      data-slot="code"
      className={cn(
        "rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Code }
