import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getOnPageRollFadeDelayMs, onPageRollPostAnimationLifetimeMs, OnPageRollOverlay } from "@/components/on-page-roll-overlay"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { type Resistance } from "@/hiveborn/game_data/resistances"
import { toast } from "sonner"
import { useEffect, useRef, useState } from "react"
import AnimatedDie from "../dice_roller/dice/animated_die"
import DiceScene from "../dice_roller/dice_scene"
import { dieSizes, rollDice } from "../dice_roller/roll_utils"
import { getRollRevealMs } from "../dice_roller/reduced_motion"
import { type DieRoll, type DieSize } from "../dice_roller/types"

type PendingStressRoll = {
    resistance: Resistance
    die: DieRoll
    characterUuid: string
    protection: number
}

const stressRollAnimationMs = 1600

const capitalize = (value: string) => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`

// Centre each mini die in its tray; the shapes sit differently inside their CSS boxes.
const previewTransforms: Record<DieSize, string> = {
    4: "translate(-50%, -50%) translate(4px, 2px) scale(0.3)",
    6: "translate(-50%, -50%) scale(0.28)",
    8: "translate(-50%, -50%) scale(0.29)",
    10: "translate(-50%, -50%) translate(0, 6px) scale(0.36)",
    12: "translate(-50%, -50%) scale(0.27)",
}

const StressDieButton = ({ size, onClick }: { size: DieSize; onClick: () => void }) => (
    <button
        type="button"
        aria-label={`Roll d${size} stress`}
        className="stress-die-tile group/tile flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-1.5 pb-2 shadow-xs transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out hover:border-heart/45 hover:shadow-sm"
        onClick={onClick}
    >
        <span
            className="relative grid h-14 w-full place-items-center overflow-hidden rounded-md bg-linear-to-b from-(--tray-top) to-(--tray-bottom) [box-shadow:inset_0_4px_10px_oklch(0_0_0/0.45)]"
            aria-hidden="true"
        >
            <span className="stress-die-preview absolute inset-0">
                <span className="absolute top-1/2 left-1/2 block" style={{ transform: previewTransforms[size] }}>
                    <AnimatedDie die={{ id: size, value: size === 8 ? 2 : size, sides: size, removed: false }} rolling={false} index={0} />
                </span>
            </span>
        </span>
        <span className="font-display text-lg leading-none font-bold tabular-nums">d{size}</span>
    </button>
)

const StressRollDialog = ({
    resistance,
    onClose,
    onRollingChange,
}: {
    resistance: Resistance | null
    onClose: () => void
    onRollingChange: (rolling: boolean) => void
}) => {
    const [pendingRoll, setPendingRoll] = useState<PendingStressRoll | null>(null)
    const protections = useCharacterStore.use.protections()
    const [overlayFadeDelayMs, setOverlayFadeDelayMs] = useState(() => getOnPageRollFadeDelayMs(stressRollAnimationMs))
    const finishTimer = useRef<number | undefined>(undefined)
    const hideTimer = useRef<number | undefined>(undefined)

    useEffect(
        () => () => {
            if (finishTimer.current) window.clearTimeout(finishTimer.current)
            if (hideTimer.current) window.clearTimeout(hideTimer.current)
        },
        [],
    )

    const rollStress = (size: DieSize) => {
        if (!resistance || pendingRoll) return

        const die = rollDice(1, size)[0]
        const { currentCharacterIndex, protections } = useCharacterStore.getState()
        const roll = {
            resistance,
            die,
            characterUuid: useCharacterStore.getState().characters[currentCharacterIndex].uuid,
            protection: protections[resistance],
        }
        setPendingRoll(roll)
        onRollingChange(true)
        onClose()

        const revealMs = getRollRevealMs(stressRollAnimationMs)
        setOverlayFadeDelayMs(getOnPageRollFadeDelayMs(revealMs))
        finishTimer.current = window.setTimeout(() => {
            const { characters, setStressForCharacter } = useCharacterStore.getState()
            const characterIndex = characters.findIndex((entry) => entry.uuid === roll.characterUuid)
            const character = characters[characterIndex]
            const finishAnimation = () => {
                setPendingRoll(null)
                onRollingChange(false)
            }

            if (!character) {
                toast.error("Could not add stress because the character sheet no longer exists")
                hideTimer.current = window.setTimeout(finishAnimation, onPageRollPostAnimationLifetimeMs)
                return
            }

            const requestedStress = Math.max(0, roll.die.value - roll.protection)
            const addedStress = Math.min(10 - character.stress[roll.resistance], requestedStress)

            if (addedStress > 0) {
                setStressForCharacter(characterIndex, {
                    ...character.stress,
                    [roll.resistance]: character.stress[roll.resistance] + addedStress,
                })
            }

            const resistanceName = capitalize(roll.resistance)
            toast(`Rolled ${roll.die.value}, added ${addedStress} ${resistanceName} stress`)

            hideTimer.current = window.setTimeout(finishAnimation, onPageRollPostAnimationLifetimeMs)
        }, revealMs)
    }

    const resistanceName = resistance ? capitalize(resistance) : ""
    const protection = resistance ? protections[resistance] : 0

    return (
        <>
            <Dialog open={resistance !== null} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <p className="eyebrow">Stress roll</p>
                        <DialogTitle>Roll for {resistanceName} stress</DialogTitle>
                        <DialogDescription>
                            {protection > 0
                                ? `Choose the stress die to roll. Your ${resistanceName} protection (${protection}) is subtracted from it.`
                                : "Choose the stress die to roll."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-5 gap-2">
                        {dieSizes.map((size) => (
                            <StressDieButton key={size} size={size} onClick={() => rollStress(size)} />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {pendingRoll && (
                // Above dialogs and the roller, below toasts (the result arrives as a toast).
                <OnPageRollOverlay className="z-(--z-popover)" fadeDelayMs={overlayFadeDelayMs} role="status">
                    <span className="sr-only">Rolling d{pendingRoll.die.sides}</span>
                    <div className="heart-roll-vignette" aria-hidden="true" />
                    <DiceScene dice={[pendingRoll.die]} rolling presentation="sheet-overlay" />
                </OnPageRollOverlay>
            )}
        </>
    )
}

export default StressRollDialog
