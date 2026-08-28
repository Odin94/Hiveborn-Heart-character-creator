import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
}

const capitalize = (value: string) => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`

const StressDieButton = ({ size, onClick }: { size: DieSize; onClick: () => void }) => (
    <Button type="button" variant="outline" className="h-16 justify-between px-3" onClick={onClick}>
        <span className="font-bold">d{size}</span>
        <span className="relative h-10 w-10 shrink-0 overflow-hidden" aria-hidden="true">
            <span className="absolute top-0 left-4 scale-[0.28] origin-top-left">
                <AnimatedDie die={{ id: size, value: size, sides: size, removed: false }} rolling={false} index={0} />
            </span>
        </span>
    </Button>
)

const StressRollDialog = ({ resistance, onClose }: { resistance: Resistance | null; onClose: () => void }) => {
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
        setPendingRoll({ resistance, die })
        onClose()

        finishTimer.current = window.setTimeout(() => {
            const { protections, stress, setStress } = useCharacterStore.getState()
            const protection = protections[resistance]
            const requestedStress = Math.max(0, die.value - protection)
            const addedStress = Math.min(10 - stress[resistance], requestedStress)

            if (addedStress > 0) setStress({ ...stress, [resistance]: stress[resistance] + addedStress })

            const resistanceName = capitalize(resistance)
            toast(`Rolled ${die.value}, added ${addedStress} ${resistanceName} stress`)

            hideTimer.current = window.setTimeout(() => setPendingRoll(null), 1000)
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
                <div className="pointer-events-none fixed top-1/2 left-1/2 z-[70] w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-primary/25 bg-background/95 p-3 shadow-2xl backdrop-blur-sm">
                    <DiceScene dice={[pendingRoll.die]} rolling />
                </div>
            )}
        </>
    )
}

export default StressRollDialog
