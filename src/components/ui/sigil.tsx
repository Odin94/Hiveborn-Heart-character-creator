import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Hiveborn's mark: a heart hanging in a hive cell, bleeding down into the city.
 * Stroke-based on a 24px grid so it sits alongside lucide icons.
 */
function HeartSigil({ className, filled = true, ...props }: React.ComponentProps<"svg"> & { filled?: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cn("size-5 shrink-0", className)}
            {...props}
        >
            <path d="M12 2.2 20.5 7.1v9.8L12 21.8l-8.5-4.9V7.1z" />
            <path
                d="M12 15.6c-2.7-2-4.1-3.5-4.1-5.1 0-1.2.9-2.1 2.1-2.1.9 0 1.6.5 2 1.2.4-.7 1.1-1.2 2-1.2 1.2 0 2.1.9 2.1 2.1 0 1.6-1.4 3.1-4.1 5.1z"
                fill={filled ? "currentColor" : "none"}
            />
            <path d="M12 15.6v3.4" />
        </svg>
    )
}

/** Ornamental divider: hairlines either side of a small sigil. */
function SigilDivider({ className, children, ...props }: React.ComponentProps<"div">) {
    return (
        <div role="separator" data-slot="sigil-divider" className={cn("sigil-rule", className)} {...props}>
            {children ?? <HeartSigil className="size-4" />}
        </div>
    )
}

export { HeartSigil, SigilDivider }
