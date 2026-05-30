import { cn } from "@/lib/utils"
import { type CSSProperties } from "react"
import { DieRoll } from "../types"
import { getD8DieTransform, getD8RollTransform } from "./transforms"

const D8Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d8-shell", isRemoved && "heart-d8-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d8", rolling && "heart-d8-rolling")}
                style={
                    {
                        "--target-transform": getD8DieTransform(die.value),
                        "--roll-transform": getD8RollTransform(die.value),
                    } as CSSProperties
                }
            >
                {Array.from({ length: 8 }).map((_, face) => (
                    <figure key={face} className={`heart-d8-face heart-d8-face-${face + 1}`}>
                        <span>{face + 1}</span>
                    </figure>
                ))}
            </div>
        </div>
    )
}

export default D8Die
