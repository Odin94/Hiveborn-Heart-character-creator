import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Dialogs grow out of whatever summoned them. We remember the last pointer-down
// position and, if it was recent, use it as the transform-origin of the dialog.
let lastPointer: { x: number; y: number; at: number } | null = null
if (typeof document !== "undefined") {
    document.addEventListener(
        "pointerdown",
        (event) => {
            lastPointer = { x: event.clientX, y: event.clientY, at: performance.now() }
        },
        { capture: true, passive: true },
    )
}

const useSummonOrigin = (ref: React.RefObject<HTMLDivElement | null>) => {
    React.useLayoutEffect(() => {
        const element = ref.current
        if (!element) return
        const pointer = lastPointer
        if (!pointer || performance.now() - pointer.at > 1000) {
            element.style.removeProperty("--hb-dialog-origin")
            return
        }
        // Layout box before any animation transform: offset* ignore transforms, so add the translate back.
        const width = element.offsetWidth
        const height = element.offsetHeight
        const [translateX = "0", translateY = "0"] = (getComputedStyle(element).translate || "0 0").split(" ")
        const toPx = (value: string, size: number) => (value.endsWith("%") ? (parseFloat(value) / 100) * size : parseFloat(value) || 0)
        const left = element.offsetLeft + toPx(translateX, width)
        const top = element.offsetTop + toPx(translateY, height)
        const clamp = (value: number, max: number) => Math.min(Math.max(value, -max * 0.25), max * 1.25)
        element.style.setProperty("--hb-dialog-origin", `${clamp(pointer.x - left, width)}px ${clamp(pointer.y - top, height)}px`)
    }, [ref])
}

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={cn("fixed inset-0 bg-[oklch(0.12_0.02_260/0.55)] backdrop-blur-[3px] dark:bg-[oklch(0.06_0.01_260/0.7)]", className)}
            {...props}
        />
    )
}

function DialogContent({
    className,
    children,
    ref,
    hideClose = false,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }) {
    const localRef = React.useRef<HTMLDivElement>(null)
    useSummonOrigin(localRef)
    const setRefs = React.useCallback(
        (node: HTMLDivElement | null) => {
            localRef.current = node
            if (typeof ref === "function") ref(node)
            else if (ref) ref.current = node
        },
        [ref],
    )

    return (
        <DialogPortal data-slot="dialog-portal">
            <DialogOverlay />
            <DialogPrimitive.Content
                ref={setRefs}
                data-slot="dialog-content"
                className={cn(
                    "fixed top-[50%] left-[50%] grid w-full max-w-[calc(100%-1.5rem)] max-h-[calc(100dvh-1.5rem-var(--safe-bottom))] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain",
                    "rounded-xl border border-border-strong/60 bg-popover p-5 text-popover-foreground shadow-lg sm:max-w-lg sm:p-6",
                    "[box-shadow:inset_0_1px_0_oklch(1_0_0/0.05),var(--elev-lg)]",
                    className,
                )}
                {...props}
            >
                {children}
                {!hideClose && (
                    // Last in DOM order (focus lands on content first), pinned top-right visually.
                    <div className="pointer-events-none order-first sticky top-0 z-10 -mb-4 flex h-0 shrink-0 justify-end">
                        <DialogPrimitive.Close
                            data-slot="dialog-close-button"
                            className="pointer-events-auto relative -top-1 -right-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent hover:text-foreground active:scale-[.97] [&_svg]:pointer-events-none [&_svg]:size-4"
                        >
                            <XIcon />
                            <span className="sr-only">Close</span>
                        </DialogPrimitive.Close>
                    </div>
                )}
            </DialogPrimitive.Content>
        </DialogPortal>
    )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 pr-8 text-left", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="dialog-footer" className={cn("mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-display text-2xl leading-tight font-bold", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-muted-foreground text-sm leading-relaxed", className)} {...props} />
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger }
