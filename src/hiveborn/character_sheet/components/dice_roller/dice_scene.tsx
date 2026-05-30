import { cn } from "@/lib/utils"
import AnimatedDie from "./dice/animated_die"
import { DieRoll } from "./types"

const DiceScene = ({ dice, rolling }: { dice: DieRoll[]; rolling: boolean }) => {
    return (
        <div className="heart-dice-stage" aria-label="Animated 3D dice roll">
            <div className={cn("heart-dice-row", dice.length > 2 && "heart-dice-row-compact", dice.length > 4 && "heart-dice-row-many")}>
                {dice.map((die, index) => (
                    <AnimatedDie key={die.id} die={die} rolling={rolling} index={index} />
                ))}
            </div>
        </div>
    )
}

export default DiceScene
