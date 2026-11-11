import { Skeleton } from "@/components/ui/skeleton"

/** Rail placeholder rows, sized like real group rows. */
export function PlayRailSkeleton() {
    return (
        <div className="space-y-1.5" aria-hidden="true">
            {[0, 1, 2].map((row) => (
                <div key={row} className="flex h-14 items-center gap-3 rounded-md px-3">
                    <Skeleton className="size-8 shrink-0 rounded-sm" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Card placeholder with the same footprint as a member character card. */
export function PlayCardSkeleton() {
    return (
        <div className="play-card flex min-h-[25rem] flex-col gap-4 p-5" aria-hidden="true">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-3.5 w-36" />
                </div>
                <Skeleton className="h-12 w-14" />
            </div>
            <div className="space-y-2.5 pt-1">
                {[0, 1, 2, 3, 4].map((row) => (
                    <Skeleton key={row} className="h-3.5 w-full" />
                ))}
            </div>
            <Skeleton className="h-16 w-full" />
            <div className="mt-auto flex gap-2">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-24" />
            </div>
        </div>
    )
}

/** Whole-page placeholder: rail, table header, cards and the activity column. */
export function PlayModeSkeleton() {
    return (
        <div className="play-shell" aria-busy="true" aria-label="Loading play groups">
            <aside className="play-rail max-lg:hidden">
                <Skeleton className="mb-4 h-3 w-24" />
                <PlayRailSkeleton />
            </aside>
            <div className="play-main">
                <div className="space-y-3 pb-6">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-72 max-w-full" />
                    <Skeleton className="h-4 w-44" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <PlayCardSkeleton />
                    <PlayCardSkeleton />
                </div>
            </div>
            <aside className="play-aside max-xl:hidden">
                <Skeleton className="mb-4 h-3 w-28" />
                <div className="space-y-2">
                    {[0, 1, 2].map((row) => (
                        <Skeleton key={row} className="h-14 w-full" />
                    ))}
                </div>
            </aside>
        </div>
    )
}
