import { cn } from "@/lib/utils"
import { type ComponentProps, type CSSProperties, type ReactNode } from "react"

type OnPageRollOverlayProps = Omit<ComponentProps<"div">, "children" | "className" | "style"> & {
    children: ReactNode
    className?: string
    fadeDelayMs: number
    blockInteraction?: boolean
}

const OnPageRollOverlay = ({ children, className, fadeDelayMs, blockInteraction = false, ...props }: OnPageRollOverlayProps) => (
    <div
        {...props}
        className={cn("fixed inset-0 heart-roll-fade-out", !blockInteraction && "pointer-events-none", className)}
        style={{ "--roll-fade-delay": `${fadeDelayMs}ms` } as CSSProperties}
    >
        {children}
    </div>
)

export default OnPageRollOverlay
