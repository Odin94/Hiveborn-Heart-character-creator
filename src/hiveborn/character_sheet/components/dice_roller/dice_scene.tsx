import { cn } from "@/lib/utils"
import AnimatedDie from "./dice/animated_die"
import { DieRoll } from "./types"

const DiceScene = ({
    dice,
    rolling,
    presentation = "inline",
    featuredIndex = -1,
}: {
    dice: DieRoll[]
    rolling: boolean
    presentation?: "inline" | "sheet-overlay"
    /** Index of the die that decides the outcome (gets a glow once settled). */
    featuredIndex?: number
}) => {
    const isSheetOverlay = presentation === "sheet-overlay"

    return (
        <div
            className={cn("heart-dice-stage", isSheetOverlay && "heart-dice-stage-sheet-overlay")}
            data-rolling={rolling || undefined}
            aria-label={isSheetOverlay ? undefined : "Animated 3D dice roll"}
            aria-hidden={isSheetOverlay || undefined}
        >
            <div
                className={cn(
                    "heart-dice-row",
                    dice.length > 2 && "heart-dice-row-compact",
                    dice.length > 4 && "heart-dice-row-many",
                    isSheetOverlay && "heart-dice-row-sheet-overlay",
                )}
            >
                {dice.map((die, index) => {
                    const animatedDie = <AnimatedDie key={die.id} die={die} rolling={rolling} index={index} featured={index === featuredIndex} />

                    return isSheetOverlay ? (
                        <div key={die.id} className="heart-dice-sheet-overlay-die">
                            {animatedDie}
                        </div>
                    ) : (
                        animatedDie
                    )
                })}
            </div>
        </div>
    )
}

export default DiceScene
