import { Minus, Plus } from "lucide-react"
import { dieSizes, maxFreeDiceCount } from "../roll_utils"
import { DieSize } from "../types"

const FreeRollControls = ({
    freeDiceCount,
    freeDieSize,
    rolling,
    setFreeDiceCount,
    setFreeDieSize,
}: {
    freeDiceCount: number
    freeDieSize: DieSize
    rolling: boolean
    setFreeDiceCount: (count: number) => void
    setFreeDieSize: (size: DieSize) => void
}) => {
    const currentDieSizeIndex = dieSizes.indexOf(freeDieSize)

    const updateDiceCount = (count: number) => {
        const nextCount = Math.min(maxFreeDiceCount, Math.max(1, count))
        setFreeDiceCount(nextCount)
    }

    const updateDieSize = (step: number) => {
        const nextIndex = Math.min(dieSizes.length - 1, Math.max(0, currentDieSizeIndex + step))
        setFreeDieSize(dieSizes[nextIndex])
    }

    return (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
                Dice
                <div className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] overflow-hidden rounded-md border border-input bg-background text-foreground shadow-xs">
                    <button
                        type="button"
                        className="flex h-full items-center justify-center border-r border-primary/20 bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-primary/35 disabled:text-primary-foreground/45"
                        aria-label="Decrease dice count"
                        disabled={rolling || freeDiceCount <= 1}
                        onClick={() => updateDiceCount(freeDiceCount - 1)}
                    >
                        <Minus size={16} strokeWidth={3} />
                    </button>
                    <input
                        type="number"
                        min={1}
                        max={maxFreeDiceCount}
                        className="heart-number-input h-full min-w-0 bg-background px-3 text-center text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        value={freeDiceCount}
                        disabled={rolling}
                        onChange={(event) => updateDiceCount(Number(event.target.value) || 1)}
                    />
                    <button
                        type="button"
                        className="flex h-full items-center justify-center border-l border-primary/20 bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-primary/35 disabled:text-primary-foreground/45"
                        aria-label="Increase dice count"
                        disabled={rolling || freeDiceCount >= maxFreeDiceCount}
                        onClick={() => updateDiceCount(freeDiceCount + 1)}
                    >
                        <Plus size={16} strokeWidth={3} />
                    </button>
                </div>
            </label>

            <label className="grid gap-1 text-sm font-semibold">
                Size
                <div className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] overflow-hidden rounded-md border border-input bg-background text-foreground shadow-xs">
                    <button
                        type="button"
                        className="flex h-full items-center justify-center border-r border-primary/20 bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-primary/35 disabled:text-primary-foreground/45"
                        aria-label="Decrease dice size"
                        disabled={rolling || currentDieSizeIndex <= 0}
                        onClick={() => updateDieSize(-1)}
                    >
                        <Minus size={16} strokeWidth={3} />
                    </button>
                    <span className="flex h-full items-center justify-center bg-background px-3 text-sm text-foreground" aria-live="polite">
                        d{freeDieSize}
                    </span>
                    <button
                        type="button"
                        className="flex h-full items-center justify-center border-l border-primary/20 bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-primary/35 disabled:text-primary-foreground/45"
                        aria-label="Increase dice size"
                        disabled={rolling || currentDieSizeIndex >= dieSizes.length - 1}
                        onClick={() => updateDieSize(1)}
                    >
                        <Plus size={16} strokeWidth={3} />
                    </button>
                </div>
            </label>
        </div>
    )
}

export default FreeRollControls
