import { lazy, Suspense, useEffect, useState } from "react"
import { create } from "zustand"
import type { useAuth } from "@/hooks/useAuth"

const QuickNavigatorPalette = lazy(() => import("./quick-navigator-palette"))

const useQuickNavigatorStore = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
    open: false,
    setOpen: (open) => set({ open }),
}))

export const openQuickNavigator = () => useQuickNavigatorStore.getState().setOpen(true)

const isApplePlatform = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
export const quickNavigatorShortcut = () => (isApplePlatform() ? "⌘K" : "Ctrl K")

/**
 * Cmd/Ctrl+K quick navigator: jump to characters, play groups, pages and common
 * actions. The palette itself is lazy-loaded on first open.
 */
export function QuickNavigator({ auth, enabled = true }: { auth: ReturnType<typeof useAuth>; enabled?: boolean }) {
    const open = useQuickNavigatorStore((state) => state.open)
    const setOpen = useQuickNavigatorStore((state) => state.setOpen)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        if (!enabled) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== "k" || event.shiftKey || event.altKey) return
            if (!(isApplePlatform() ? event.metaKey : event.ctrlKey)) return
            event.preventDefault()
            setOpen(!useQuickNavigatorStore.getState().open)
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [enabled, setOpen])

    useEffect(() => {
        if (open) setLoaded(true)
    }, [open])

    if (!enabled || (!open && !loaded)) return null
    return (
        <Suspense fallback={null}>
            <QuickNavigatorPalette auth={auth} open={open} onOpenChange={setOpen} />
        </Suspense>
    )
}
