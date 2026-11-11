import * as React from "react"

import { cn } from "@/lib/utils"

/** Reserve the exact space of the content that is loading; shimmer is disabled for reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="skeleton" aria-hidden="true" className={cn("rounded-md bg-foreground/8", className)} {...props} />
}

export { Skeleton }
