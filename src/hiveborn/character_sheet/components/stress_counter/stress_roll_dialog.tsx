import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import OnPageRollOverlay from "@/components/on-page-roll-overlay"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { type Resistance } from "@/hiveborn/game_data/resistances"
import { toast } from "sonner"
import { useEffect, useRef, useState } from "react"
import AnimatedDie from "../dice_roller/dice/animated_die"
import DiceScene from "../dice_roller/dice_scene"
import { dieSizes, rollDice } from "../dice_roller/roll_utils"
import { type DieRoll, type DieSize } from "../dice_roller/types"

type PendingStressRoll = {
    resistance: Resistance
    die: DieRoll
    characterIndex: number
    protection: number
}

const capitalize = (value: string) => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`

const StressDieButton = ({ size, onClick }: { size: DieSize; onClick: () => void }) => (
    <Button type="button" variant="outline" className="h-20 justify-between px-4" onClick={onClick}>
        <span className="font-bold">d{size}</span>
        <span className="relative h-12 w-16 shrink-0 overflow-visible" aria-hidden="true">
            <span className="absolute top-0 left-4 scale-[0.32] origin-top-left">
                <AnimatedDie die={{ id: size, value: size === 8 ? 2 : size, sides: size, removed: false }} rolling={false} index={0} />
            </span>
        </span>
    </Button>
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
        const roll = { resistance, die, characterIndex: currentCharacterIndex, protection: protections[resistance] }
        setPendingRoll(roll)
        onRollingChange(true)
        onClose()

        finishTimer.current = window.setTimeout(() => {
            const { characters, setStressForCharacter } = useCharacterStore.getState()
            const character = characters[roll.characterIndex]
            const finishAnimation = () => {
                setPendingRoll(null)
                onRollingChange(false)
            }

            if (!character) {
                toast.error("Could not add stress because the character sheet no longer exists")
                hideTimer.current = window.setTimeout(finishAnimation, 1000)
                return
            }

            const requestedStress = Math.max(0, roll.die.value - roll.protection)
            const addedStress = Math.min(10 - character.stress[roll.resistance], requestedStress)

            if (addedStress > 0) {
                setStressForCharacter(roll.characterIndex, {
                    ...character.stress,
                    [roll.resistance]: character.stress[roll.resistance] + addedStress,
                })
            }

            const resistanceName = capitalize(roll.resistance)
            toast(`Rolled ${roll.die.value}, added ${addedStress} ${resistanceName} stress`)

            hideTimer.current = window.setTimeout(finishAnimation, 1000)
        }, 1600)
    }

    const resistanceName = resistance ? capitalize(resistance) : ""

    return (
        <>
            <Dialog open={resistance !== null} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Roll for {resistanceName} stress</DialogTitle>
                        <DialogDescription>Choose the stress die to roll.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {dieSizes.map((size) => (
                            <StressDieButton key={size} size={size} onClick={() => rollStress(size)} />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {pendingRoll && (
                <OnPageRollOverlay className="z-[70]" fadeDelayMs={1600} role="status">
                    <span className="sr-only">Rolling d{pendingRoll.die.sides}</span>
                    <DiceScene dice={[pendingRoll.die]} rolling presentation="sheet-overlay" />
                </OnPageRollOverlay>
            )}
        </>
    )
}

export default StressRollDialog
