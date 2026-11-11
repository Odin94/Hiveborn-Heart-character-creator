import { cn } from "@/lib/utils"
import { type ComponentProps, type CSSProperties, type ReactNode } from "react"

export const onPageRollResultHoldMs = 700
export const onPageRollFadeDurationMs = 1000
export const getOnPageRollFadeDelayMs = (animationDurationMs: number) => animationDurationMs + onPageRollResultHoldMs
export const onPageRollPostAnimationLifetimeMs = onPageRollResultHoldMs + onPageRollFadeDurationMs

type OnPageRollOverlayProps = Omit<ComponentProps<"div">, "children" | "className" | "style"> & {
    children: ReactNode
    className?: string
    fadeDelayMs: number
    fadeDurationMs?: number
    blockInteraction?: boolean
}

/** Full-viewport layer for dice that land on the page itself; fades out after the result has been held. */
export const OnPageRollOverlay = ({
    children,
    className,
    fadeDelayMs,
    fadeDurationMs = onPageRollFadeDurationMs,
    blockInteraction = false,
    ...props
}: OnPageRollOverlayProps) => (
    <div
        {...props}
        className={cn("fixed inset-0 z-(--z-roll) heart-roll-fade-out", !blockInteraction && "pointer-events-none", className)}
        style={{ "--roll-fade-delay": `${fadeDelayMs}ms`, "--roll-fade-duration": `${fadeDurationMs}ms` } as CSSProperties}
    >
        {children}
    </div>
)

export default OnPageRollOverlay
