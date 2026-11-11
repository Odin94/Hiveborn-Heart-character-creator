import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * A titled block of the sheet: a notched crimson band (`.sheet-section-heading`)
 * with its field attached directly underneath.
 */
export const SheetSection = ({
    title,
    action,
    aside,
    className,
    children,
}: {
    title: ReactNode
    /** Usually a <DialogTriggerWrapper/> or another <SectionAction/>. */
    action?: ReactNode
    /** Small caps label on the right side of the band (e.g. "Knacks"). */
    aside?: ReactNode
    className?: string
    children: ReactNode
}) => (
    <section className={cn("flex min-w-0 flex-col text-left", className)}>
        <h2 className="sheet-section-heading text-primary-foreground">
            <span className="min-w-0 truncate">{title}</span>
            {aside ? <span className="sheet-band-aside">{aside}</span> : null}
            {action}
        </h2>
        {children}
    </section>
)

/** Positions an icon button at the right end of a band, vertically centered. */
export const SectionAction = ({ children }: { children: ReactNode }) => (
    <span className="absolute inset-y-0 right-3 flex items-center sm:right-4">{children}</span>
)

/** A hive cell with a plus: "add from the list". Sits beside lucide icons. */
export const HiveCellPlus = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn("size-5", className)}
    >
        <path d="M12 2.6 20.2 7.3v9.4L12 21.4l-8.2-4.7V7.3z" />
        <path d="M12 8.6v6.8M8.6 12h6.8" />
    </svg>
)
