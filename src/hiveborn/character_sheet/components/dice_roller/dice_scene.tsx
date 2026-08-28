import { cn } from "@/lib/utils"
import AnimatedDie from "./dice/animated_die"
import { DieRoll } from "./types"

const DiceScene = ({ dice, rolling, presentation = "inline" }: { dice: DieRoll[]; rolling: boolean; presentation?: "inline" | "sheet-overlay" }) => {
    const isSheetOverlay = presentation === "sheet-overlay"

    return (
        <div className={cn("heart-dice-stage", isSheetOverlay && "heart-dice-stage-sheet-overlay")} aria-label="Animated 3D dice roll">
            <div
                className={cn(
                    "heart-dice-row",
                    dice.length > 2 && "heart-dice-row-compact",
                    dice.length > 4 && "heart-dice-row-many",
                    isSheetOverlay && "heart-dice-row-sheet-overlay",
                )}
            >
                {dice.map((die, index) => {
                    const animatedDie = <AnimatedDie key={die.id} die={die} rolling={rolling} index={index} />

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
