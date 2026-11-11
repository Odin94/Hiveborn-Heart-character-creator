import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const HasProviderContext = React.createContext(false)

/**
 * App-wide provider (mounted in App.tsx). Shared provider = once one tooltip is
 * visible, the next one opens instantly (no delay, no animation).
 */
function TooltipProvider({ delayDuration = 350, skipDelayDuration = 500, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
    return (
        <HasProviderContext.Provider value={true}>
            <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />
        </HasProviderContext.Provider>
    )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
    const hasProvider = React.useContext(HasProviderContext)
    const root = <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    // Fallback for isolated renders (tests, portals mounted outside the app shell).
    return hasProvider ? root : <TooltipProvider>{root}</TooltipProvider>
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
    return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({ className, sideOffset = 6, collisionPadding = 8, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                data-slot="tooltip-content"
                sideOffset={sideOffset}
                collisionPadding={collisionPadding}
                className={cn(
                    "w-fit max-w-[min(20rem,calc(100vw-1rem))] rounded-md border border-[oklch(1_0_0/0.08)] bg-[oklch(0.2_0.02_258)] px-2.5 py-1.5 text-xs leading-snug font-medium text-balance text-[oklch(0.95_0.012_80)] shadow-md",
                    "dark:border-border-strong/60 dark:bg-[oklch(0.28_0.022_258)]",
                    className,
                )}
                {...props}
            >
                {children}
                <TooltipPrimitive.Arrow width={10} height={5} className="fill-[oklch(0.2_0.02_258)] dark:fill-[oklch(0.28_0.022_258)]" />
            </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
    )
}

/**
 * One-liner tooltip. Use `wrap` when the child may be disabled (disabled
 * buttons swallow pointer events), so the reason still shows on hover.
 *
 *   <Hint label="Sign in to share rolls" wrap><Button disabled>Share</Button></Hint>
 */
function Hint({
    label,
    children,
    side,
    align,
    wrap = false,
    disabled = false,
}: {
    label: React.ReactNode
    children: React.ReactElement
    side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"]
    align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"]
    wrap?: boolean
    disabled?: boolean
}) {
    if (disabled || !label) return children
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {wrap ? (
                    <span className="inline-flex" tabIndex={0}>
                        {children}
                    </span>
                ) : (
                    children
                )}
            </TooltipTrigger>
            <TooltipContent side={side} align={align}>
                {label}
            </TooltipContent>
        </Tooltip>
    )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Hint }
