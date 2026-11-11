import { cn } from "@/lib/utils"
import { type CSSProperties } from "react"
import { type DieProps } from "../types"
import { getD12DieTransform, getD12RollTransform } from "./transforms"

const D12Die = ({ die, rolling, index, featured = false }: DieProps) => {
    const isRemoved = !rolling && die.removed

    return (
        <div
            className={cn(
                "heart-die-shell heart-d12-shell",
                rolling && "heart-die-shell-rolling",
                isRemoved && "heart-d12-shell-removed heart-die-shell-removed",
                featured && !rolling && !isRemoved && "heart-die-shell-featured",
            )}
            style={{ "--die-delay": `${index * 90}ms` } as CSSProperties}
        >
            <div
                className={cn("heart-d12", rolling && "heart-d12-rolling")}
                style={
                    {
                        "--target-transform": getD12DieTransform(die.value),
                        "--roll-transform": getD12RollTransform(die.value),
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
