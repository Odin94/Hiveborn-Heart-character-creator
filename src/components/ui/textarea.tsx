import * as React from "react"

import { cn } from "@/lib/utils"

const textareaClassName = cn(
    "flex field-sizing-content min-h-20 w-full resize-none rounded-md border border-input bg-sunken px-3 py-2.5 text-foreground shadow-xs scrollbar",
    "text-base sm:text-sm leading-relaxed placeholder:text-muted-foreground/75",
    "transition-[color,background-color,border-color] duration-150 ease-out",
    "hover:border-border-strong focus-visible:border-ring",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
)

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
    return <textarea data-slot="textarea" className={cn(textareaClassName, className)} {...props} />
}

export { Textarea, textareaClassName }
