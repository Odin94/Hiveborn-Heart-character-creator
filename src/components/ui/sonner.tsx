import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useThemeStore } from "@/lib/theme"

// Height of the floating dice button (3rem) plus a gap, so toasts never cover it.
const dockClearance = "3.75rem"

/**
 * Toasts, skinned in index.css ("TOASTS" section). For reversible actions
 * (archive, move) show a toast with an Undo action instead of a confirm dialog:
 *
 *   toast("Character archived", { action: { label: "Undo", onClick: restore } })
 */
const Toaster = ({ aboveDock = false, ...props }: ToasterProps & { aboveDock?: boolean }) => {
    const theme = useThemeStore((state) => state.theme)
    const lift = aboveDock ? ` + ${dockClearance}` : ""

    return (
        <Sonner
            theme={theme}
            className="toaster group"
            position="bottom-right"
            offset={{ bottom: `calc(max(1rem, env(safe-area-inset-bottom) + 1rem)${lift})`, right: "1rem" }}
            mobileOffset={{ bottom: `calc(max(0.75rem, env(safe-area-inset-bottom) + 0.75rem)${lift})`, left: "0.75rem", right: "0.75rem" }}
            icons={{
                success: <CircleCheck className="size-4" />,
                error: <CircleAlert className="size-4" />,
                warning: <TriangleAlert className="size-4" />,
                info: <Info className="size-4" />,
                loading: <LoaderCircle className="size-4 animate-spin" />,
            }}
            {...props}
        />
    )
}

export { Toaster }
