import * as React from "react"

import { Button } from "./button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"

type ConfirmDialogProps = {
    /** Element that opens the dialog (rendered asChild). Omit when controlling `open`. */
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    title: React.ReactNode
    description?: React.ReactNode
    /** Spell out the verb: "Delete", "Reset", "Remove". */
    confirmLabel?: React.ReactNode
    cancelLabel?: React.ReactNode
    /** Destructive actions get the danger button. Defaults to true. */
    destructive?: boolean
    /** May return a promise; the dialog stays open (button busy) until it settles. */
    onConfirm: () => void | Promise<unknown>
    children?: React.ReactNode
}

/**
 * Custom confirmation for destructive / hard-to-recreate actions.
 * Focus starts on Cancel, so Enter never destroys anything by accident.
 *
 *   <ConfirmDialog
 *       trigger={<TrashButton aria-label={`Delete ${name}`} />}
 *       title={`Delete ${name}?`}
 *       description="You can restore it from Deleted characters."
 *       confirmLabel="Delete"
 *       onConfirm={() => remove(index)}
 *   />
 */
function ConfirmDialog({
    trigger,
    open: openProp,
    onOpenChange,
    title,
    description,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    destructive = true,
    onConfirm,
    children,
}: ConfirmDialogProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const open = openProp ?? uncontrolledOpen
    const setOpen = (next: boolean) => {
        if (openProp === undefined) setUncontrolledOpen(next)
        onOpenChange?.(next)
    }

    const confirm = async () => {
        const result = onConfirm()
        if (result && typeof (result as Promise<unknown>).then === "function") {
            setBusy(true)
            try {
                await result
                setOpen(false)
            } finally {
                setBusy(false)
            }
            return
        }
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
            {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
            <DialogContent data-confirm-dialog="" className="sm:max-w-md" role="alertdialog">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description ? <DialogDescription>{description}</DialogDescription> : null}
                </DialogHeader>
                {children}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary" disabled={busy}>
                            {cancelLabel}
                        </Button>
                    </DialogClose>
                    <Button variant={destructive ? "destructive" : "default"} disabled={busy} onClick={() => void confirm()}>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export { ConfirmDialog }
export type { ConfirmDialogProps }
