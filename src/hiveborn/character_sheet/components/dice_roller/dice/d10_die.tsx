import { cn } from "@/lib/utils"
import { type CSSProperties } from "react"
import { DieRoll } from "../types"
import { d10FaceCount, getD10DieTransform, getD10RollTransform } from "./d10_transforms"

const D10Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const faceIndex = die.value === 10 ? 0 : die.value
    const isRemoved = !rolling && die.removed

    return (
        <div className={cn("heart-d10-shell", isRemoved && "heart-d10-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d10", rolling && "heart-d10-rolling")}
                data-face={faceIndex}
                style={
                    {
                        "--target-transform": getD10DieTransform(faceIndex),
                        "--roll-transform": getD10RollTransform(faceIndex),
                    } as CSSProperties
                }
            >
                {Array.from({ length: d10FaceCount }).map((_, face) => (
                    <figure key={face} className={`heart-d10-face heart-d10-face-${face}`}>
                        <span>{face === 0 ? 10 : face}</span>
                    </figure>
                ))}
            </div>
        </div>
    )
}

export default D10Die
