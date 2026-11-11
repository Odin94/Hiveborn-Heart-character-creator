import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    [
        "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent",
        "text-sm font-semibold leading-none",
        "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out",
        "active:scale-[.97] disabled:opacity-50 aria-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "aria-invalid:border-destructive",
    ],
    {
        variants: {
            variant: {
                /** Crimson fill — the one main action in a region. */
                default: "bg-primary text-primary-foreground [box-shadow:inset_0_1px_0_oklch(1_0_0/0.14),var(--elev-sm)] not-disabled:hover:bg-primary-hover",
                /** Alias of default, for readability at call sites. */
                primary: "bg-primary text-primary-foreground [box-shadow:inset_0_1px_0_oklch(1_0_0/0.14),var(--elev-sm)] not-disabled:hover:bg-primary-hover",
                /** Bone / iron fill with a hairline — secondary actions. */
                secondary:
                    "border-border bg-secondary text-secondary-foreground shadow-xs not-disabled:hover:border-border-strong not-disabled:hover:bg-[color-mix(in_oklab,var(--secondary)_80%,var(--foreground)_6%)]",
                /** Transparent with a border — tertiary actions on busy surfaces. */
                outline:
                    "border-border-strong/70 bg-transparent text-foreground not-disabled:hover:border-border-strong not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground",
                /** No chrome until hovered — toolbars, icon buttons. */
                ghost: "bg-transparent text-foreground not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground",
                /** Quiet, low-emphasis: muted text that warms on hover. */
                subtle: "bg-muted/70 text-muted-foreground not-disabled:hover:bg-accent not-disabled:hover:text-foreground",
                /** Irreversible / dangerous actions. Label it with the verb ("Delete"). */
                destructive:
                    "bg-destructive text-destructive-foreground [box-shadow:inset_0_1px_0_oklch(1_0_0/0.14),var(--elev-sm)] not-disabled:hover:bg-[color-mix(in_oklab,var(--destructive)_88%,black)]",
                /** Alias of destructive. */
                danger: "bg-destructive text-destructive-foreground [box-shadow:inset_0_1px_0_oklch(1_0_0/0.14),var(--elev-sm)] not-disabled:hover:bg-[color-mix(in_oklab,var(--destructive)_88%,black)]",
                /** Inline text action. */
                link: "h-auto border-0 bg-transparent p-0 font-medium text-heart underline-offset-4 not-disabled:hover:underline active:scale-100",
            },
            size: {
                xs: "h-7 gap-1.5 rounded-sm px-2.5 text-xs has-[>svg]:px-2",
                sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
                default: "h-10 px-4 has-[>svg]:px-3.5",
                lg: "h-11 px-6 text-base has-[>svg]:px-5",
                icon: "size-10",
                "icon-sm": "size-8",
                "icon-xs": "size-7 rounded-sm",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
)

type ButtonProps = React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean
    }

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
    const Comp = asChild ? Slot : "button"

    return <Comp data-slot="button" data-variant={variant ?? "default"} className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

/**
 * Subtle icon-only delete. Always pass an aria-label naming the thing
 * ("Delete Ysolde"). Pair with <ConfirmDialog confirmLabel="Delete"> unless undoable.
 */
function TrashButton({ className, size = "icon-sm", children, ...props }: Omit<ButtonProps, "variant">) {
    return (
        <Button
            variant="ghost"
            size={size}
            data-slot="trash-button"
            className={cn(
                "text-muted-foreground not-disabled:hover:bg-destructive/12 not-disabled:hover:text-destructive dark:not-disabled:hover:bg-destructive/20",
                className,
            )}
            {...props}
        >
            {children ?? <Trash2 aria-hidden="true" />}
        </Button>
    )
}

export { Button, TrashButton, buttonVariants }
export type { ButtonProps }
