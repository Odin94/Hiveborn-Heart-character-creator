import * as React from "react"

import { cn } from "@/lib/utils"

/** Shared field chrome: <Input>, <SelectTrigger> and native .form-select all match (h-10). */
const fieldClassName = cn(
    "flex h-10 w-full min-w-0 rounded-md border border-input bg-sunken px-3 text-foreground shadow-xs",
    "text-base sm:text-sm placeholder:text-muted-foreground/75",
    "transition-[color,background-color,border-color] duration-150 ease-out",
    "hover:border-border-strong focus-visible:border-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-destructive",
)

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                fieldClassName,
                "file:text-foreground file:mr-3 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
                className,
            )}
            {...props}
        />
    )
}

export { Input, fieldClassName }
