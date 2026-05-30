import { cn } from "@/lib/utils"
import { type CSSProperties } from "react"
import { DieRoll } from "../types"
import { d12Transforms } from "./transforms"

const D12Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d12-shell", isRemoved && "heart-d12-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d12", rolling && "heart-d12-rolling")}
                style={
                    {
                        "--target-transform": d12Transforms[die.value],
                        "--roll-transform": `rotateX(${720 + die.value * 31}deg) rotateY(${1080 + die.value * 59}deg) rotateZ(720deg)`,
                    } as CSSProperties
                }
            >
                {Array.from({ length: 12 }).map((_, face) => (
                    <figure key={face} className={`heart-d12-face heart-d12-face-${face + 1}`}>
                        <span>{face + 1}</span>
                    </figure>
                ))}
            </div>
        </div>
    )
}

export default D12Die
