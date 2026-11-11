import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

type TabsVariant = "segmented" | "underline"
const TabsVariantContext = React.createContext<TabsVariant>("segmented")

/**
 * Styled tabs. `segmented` = pill track with a crimson active segment (compact
 * pickers). `underline` = text tabs with a crimson rule (section switches).
 *
 * When tabs represent page-level navigation, drive `value` from the URL
 * (TanStack Router search params) instead of local state.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-3", className)} {...props} />
}

function TabsList({ className, variant = "segmented", ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
    return (
        <TabsVariantContext.Provider value={variant}>
            <TabsPrimitive.List
                data-slot="tabs-list"
                data-variant={variant}
                className={cn(
                    variant === "segmented"
                        ? "segmented-control inline-flex w-full items-stretch rounded-lg border"
                        : "flex w-full items-end gap-1 overflow-x-auto border-b border-border scrollbar-none",
                    className,
                )}
                {...props}
            />
        </TabsVariantContext.Provider>
    )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    const variant = React.useContext(TabsVariantContext)
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 px-3 whitespace-nowrap outline-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
                variant === "underline" &&
                    "relative h-10 flex-none px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground data-[state=active]:text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 after:ease-out data-[state=active]:after:scale-x-100",
                className,
            )}
            {...props}
        />
    )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            data-slot="tabs-content"
            className={cn("min-h-0 flex-1 outline-none data-[state=active]:animate-hb-fade-in", className)}
            {...props}
        />
    )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
