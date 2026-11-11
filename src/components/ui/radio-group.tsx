import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
    return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-3", className)} {...props} />
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
    return (
        <RadioGroupPrimitive.Item
            data-slot="radio-group-item"
            className={cn(
                "relative aspect-square size-4 shrink-0 rounded-full border border-border-strong bg-sunken shadow-xs outline-none",
                "transition-[border-color,background-color] duration-120 ease-out",
                "before:absolute before:-inset-1.5 before:rounded-full before:content-['']",
                "hover:border-primary/70 data-[state=checked]:border-primary",
                "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
                className,
            )}
            {...props}
        >
            <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" className="absolute inset-0 grid place-items-center">
                <span className="size-2 animate-hb-fade-in rounded-full bg-primary" />
            </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
    )
}

export { RadioGroup, RadioGroupItem }
