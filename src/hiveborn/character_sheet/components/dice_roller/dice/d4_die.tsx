import { cn } from "@/lib/utils"
import { type CSSProperties } from "react"
import { DieRoll } from "../types"
import { d4Transforms } from "./transforms"

const d4OriginX = "105%"
const d4OriginY = "55%"

const getD4FaceNumbers = (topValue: number) => {
    const remainingValues = [1, 2, 3, 4].filter((value) => value !== topValue)
    const [leftValue, rightValue, backValue] = remainingValues

    return [
        [topValue, leftValue, rightValue],
        [topValue, backValue, leftValue],
        [topValue, rightValue, backValue],
        [backValue, rightValue, leftValue],
    ]
}

const D4Die = ({ die, rolling, index }: { die: DieRoll; rolling: boolean; index: number }) => {
    const isRemoved = !rolling && die.removed
    const finalYaw = die.value === 1 ? 0 : die.value === 2 ? 120 : die.value === 3 ? 240 : 60
    const faceNumbers = getD4FaceNumbers(die.value)

    return (
        <div className={cn("heart-d4-shell", isRemoved && "heart-d4-shell-removed")} style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}>
            <div
                className={cn("heart-d4", rolling && "heart-d4-rolling")}
                style={
                    {
                        "--target-transform": d4Transforms[die.value],
                        "--roll-transform": `rotateX(360deg) rotateY(${720 + finalYaw}deg) rotateZ(0deg)`,
                        "--d4-origin-x": d4OriginX,
                        "--d4-origin-y": d4OriginY,
                    } as CSSProperties
                }
            >
                {faceNumbers.map((numbers, face) => (
                    <figure key={face} className={`heart-d4-face heart-d4-face-${face + 1}`}>
                        {numbers.map((number, numberIndex) => (
                            <span key={`${number}-${numberIndex}`} className="heart-d4-number">
                                {number}
                            </span>
                        ))}
                    </figure>
                ))}
            </div>
        </div>
    )
}

export default D4Die
