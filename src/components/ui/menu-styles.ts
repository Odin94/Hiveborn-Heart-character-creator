import { cn } from "@/lib/utils"

/** Shared skin for dropdown menus, context menus and select popovers. */
export const menuContentClassName = cn(
    "min-w-[10rem] overflow-x-hidden overflow-y-auto rounded-lg border border-border-strong/50 bg-popover p-1 text-popover-foreground",
    "[box-shadow:inset_0_1px_0_oklch(1_0_0/0.05),var(--elev-lg)] outline-none",
)

export const menuItemClassName = cn(
    "relative flex min-h-8 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-hidden select-none",
    "transition-colors duration-100 ease-out",
    "focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8",
    "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:data-[highlighted]:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20",
    "data-[variant=destructive]:*:[svg]:!text-destructive",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
)

export const menuIndicatorItemClassName = cn(menuItemClassName, "pl-8")

export const menuLabelClassName = "px-2.5 pt-2 pb-1 text-[0.6875rem] font-bold tracking-[0.14em] text-muted-foreground uppercase data-[inset]:pl-8"

export const menuSeparatorClassName = "-mx-1 my-1 h-px bg-border"

export const menuShortcutClassName = "ml-auto pl-4 text-xs tracking-widest text-muted-foreground"
