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
                aria-pressed={isSelected}
                className={cn(
                    "trait-name -mx-1 min-w-0 truncate rounded-sm px-1 py-0.5 text-left select-none touch-manipulation transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent active:scale-[.97]",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary-hover",
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
                    className="trait-note absolute top-[calc(100%+0.45rem)] left-0 z-(--z-popover) w-[min(15rem,calc(100vw-3rem))] origin-top-left rounded-md border border-border-strong/70 bg-popover px-3 py-2 text-left text-xs leading-snug font-normal tracking-normal text-popover-foreground normal-case shadow-md before:absolute before:-top-[5px] before:left-4 before:size-2 before:rotate-45 before:border-t before:border-l before:border-border-strong/70 before:bg-popover"
                >
                    <span className="eyebrow mb-0.5 block">{label}</span>
                    {description}
                </span>
            )}
        </span>
    )
}

export default SkillDomainTooltip
