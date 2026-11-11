import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Stack of rulebook choices inside a picker dialog (abilities, beats). */
export const PickerList = ({ className, children }: { className?: string; children: ReactNode }) => (
    <div className={cn("grid gap-2 pr-3 pb-1", className)}>{children}</div>
)

export const PickerEmpty = ({ children }: { children: ReactNode }) => (
    <div className="mr-3 rounded-md border border-dashed border-border-strong/60 px-4 py-8 text-center text-sm text-muted-foreground animate-hb-fade-in">
        {children}
    </div>
)
