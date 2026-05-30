import { cn } from "@/lib/utils"
import { type CSSProperties } from "react"
import { DieRoll } from "../types"
import { d8Transforms } from "./transforms"

const D8Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d8-shell", isRemoved && "heart-d8-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d8", rolling && "heart-d8-rolling")}
                style={
                    {
                        "--target-transform": d8Transforms[die.value],
                        "--roll-transform": `rotateX(${720 + die.value * 53}deg) rotateY(${1080 + die.value * 71}deg) rotateZ(720deg)`,
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
