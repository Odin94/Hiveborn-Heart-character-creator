import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

import { cn } from "@/lib/utils"

/**
 * Ink-box checkbox: checked state is a solid crimson box (like a filled stress
 * track on the printed sheet). The hit area extends 6px beyond the visual box.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                "peer relative size-4 shrink-0 rounded-[3px] border border-border-strong bg-sunken shadow-xs outline-none",
                "transition-[background-color,border-color,box-shadow] duration-120 ease-out",
                "before:absolute before:-inset-1.5 before:content-['']",
                "hover:border-primary/70",
                "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:[box-shadow:inset_0_1px_0_oklch(1_0_0/0.18)]",
                "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary/40",
                "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="pointer-events-none absolute inset-0 animate-hb-fade-in" />
        </CheckboxPrimitive.Root>
    )
}

export { Checkbox }
