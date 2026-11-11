import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useThemeStore } from "@/lib/theme"

/**
 * Toasts, skinned in index.css ("TOASTS" section). For reversible actions
 * (archive, move) show a toast with an Undo action instead of a confirm dialog:
 *
 *   toast("Character archived", { action: { label: "Undo", onClick: restore } })
 */
const Toaster = ({ ...props }: ToasterProps) => {
    const theme = useThemeStore((state) => state.theme)

    return (
        <Sonner
            theme={theme}
            className="toaster group"
            position="bottom-right"
            offset={{ bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 1rem))", right: "1rem" }}
            mobileOffset={{ bottom: "max(0.75rem, calc(env(safe-area-inset-bottom) + 0.75rem))", left: "0.75rem", right: "0.75rem" }}
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
