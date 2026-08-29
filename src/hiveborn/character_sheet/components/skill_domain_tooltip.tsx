import { useId, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type SkillDomainTooltipProps = {
    description: string
    isSelected: boolean
    label: string
    onSelect: () => void
}

const LONG_PRESS_DELAY = 500
const LONG_PRESS_MOVE_TOLERANCE = 12

/** A parchment-style reference note for skill and domain labels. */
const SkillDomainTooltip = ({ description, isSelected, label, onSelect }: SkillDomainTooltipProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const descriptionId = `skill-domain-description-${useId().replace(/:/g, "")}`
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const didLongPress = useRef(false)
    const touchStart = useRef<{ x: number; y: number } | null>(null)

    const clearLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    return (
        <span className="relative inline-flex shrink-0">
            <button
                type="button"
                aria-describedby={isOpen ? descriptionId : undefined}
                className={cn(
                    "select-none rounded-sm px-1 text-left font-bold touch-manipulation hover:bg-red-900/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900",
                    isSelected && "bg-red-900 text-white hover:bg-red-900",
                )}
                onBlur={() => setIsOpen(false)}
                onClick={() => {
                    if (didLongPress.current) {
                        didLongPress.current = false
                        return
                    }
                    onSelect()
                }}
                onContextMenu={(event) => event.preventDefault()}
                onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible")) setIsOpen(true)
                }}
                onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") setIsOpen(true)
                }}
                onKeyDown={(event) => {
                    if (event.key === "Escape") setIsOpen(false)
                }}
                onPointerCancel={() => {
                    clearLongPress()
                    touchStart.current = null
                }}
                onPointerDown={(event) => {
                    if (event.pointerType !== "touch") {
                        setIsOpen(true)
                        return
                    }

                    didLongPress.current = false
                    touchStart.current = { x: event.clientX, y: event.clientY }
                    longPressTimer.current = setTimeout(() => {
                        didLongPress.current = true
                        setIsOpen(true)
                    }, LONG_PRESS_DELAY)
                }}
                onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") setIsOpen(false)
                }}
                onPointerMove={(event) => {
                    if (event.pointerType !== "touch" || !touchStart.current) return

                    const movedX = event.clientX - touchStart.current.x
                    const movedY = event.clientY - touchStart.current.y
                    if (Math.hypot(movedX, movedY) > LONG_PRESS_MOVE_TOLERANCE) {
                        clearLongPress()
                        touchStart.current = null
                        didLongPress.current = false
                        setIsOpen(false)
                    }
                }}
                onPointerUp={() => {
                    clearLongPress()
                    touchStart.current = null
                }}
            >
                {label}
            </button>
            {isOpen && (
                <span
                    id={descriptionId}
                    role="tooltip"
                    className="absolute top-[calc(100%+0.45rem)] left-0 z-30 w-60 rounded-sm border border-red-900/30 bg-[#fffaf0] px-3 py-2 text-left text-xs leading-snug font-normal text-foreground shadow-[3px_3px_0_oklch(39.6%_0.141_25.723_/_0.18)] before:absolute before:-top-1 before:left-4 before:size-2 before:rotate-45 before:border-t before:border-l before:border-red-900/30 before:bg-[#fffaf0] dark:bg-card dark:before:bg-card"
                >
                    <span className="mb-0.5 block text-[0.65rem] font-extrabold tracking-[0.16em] text-red-900">{label}</span>
                    {description}
                </span>
            )}
        </span>
    )
}

export default SkillDomainTooltip
