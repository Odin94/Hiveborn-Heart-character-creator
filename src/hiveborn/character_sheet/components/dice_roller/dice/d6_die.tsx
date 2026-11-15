import { cn } from "@/lib/utils"
import { type CSSProperties } from "react"
import { DieRoll } from "../types"
import { getD6DieTransform, getD6RollTransform } from "./transforms"

const D6Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d6-shell", isRemoved && "heart-d6-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d6", rolling && "heart-d6-rolling")}
                style={
                    {
                        "--target-transform": getD6DieTransform(die.value),
                        "--roll-transform": getD6RollTransform(die.value),
                    } as CSSProperties
                }
            >
                {Array.from({ length: 6 }).map((_, face) => (
                    <figure key={face} className={`heart-d6-face heart-d6-face-${face + 1}`}>
                        <span>{face + 1}</span>
                    </figure>
                ))}
            </div>
        </div>
    )
}

export default D6Die
