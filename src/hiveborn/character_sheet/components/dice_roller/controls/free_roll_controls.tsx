import { Minus, Plus } from "lucide-react"
import { dieSizes, maxFreeDiceCount } from "../roll_utils"
import { DieSize } from "../types"

const stepButtonClassName =
    "grid h-full w-10 shrink-0 place-items-center text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent hover:text-foreground disabled:opacity-35 [&_svg]:size-4"

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
    const updateDiceCount = (count: number) => {
        const nextCount = Math.min(maxFreeDiceCount, Math.max(1, count))
        setFreeDiceCount(nextCount)
    }

    return (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
            <div className="grid gap-1.5">
                <label htmlFor="dice-roller-free-count" className="text-sm leading-none font-semibold">
                    Dice
                </label>
                <div className="flex h-10 items-stretch overflow-hidden rounded-md border border-input bg-sunken shadow-xs focus-within:border-ring">
                    <button
                        type="button"
                        className={`${stepButtonClassName} border-r border-input`}
                        aria-label="Decrease dice count"
                        disabled={rolling || freeDiceCount <= 1}
                        onClick={() => updateDiceCount(freeDiceCount - 1)}
                    >
                        <Minus strokeWidth={2.5} />
                    </button>
                    <input
                        id="dice-roller-free-count"
                        type="number"
                        min={1}
                        max={maxFreeDiceCount}
                        inputMode="numeric"
                        className="heart-number-input h-full min-w-0 flex-1 bg-transparent px-2 text-center font-display text-xl font-bold tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        value={freeDiceCount}
                        disabled={rolling}
                        onChange={(event) => updateDiceCount(Number(event.target.value) || 1)}
                    />
                    <button
                        type="button"
                        className={`${stepButtonClassName} border-l border-input`}
                        aria-label="Increase dice count"
                        disabled={rolling || freeDiceCount >= maxFreeDiceCount}
                        onClick={() => updateDiceCount(freeDiceCount + 1)}
                    >
                        <Plus strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            <div className="grid gap-1.5">
                <span id="dice-roller-free-size" className="text-sm leading-none font-semibold">
                    Size
                </span>
                <div className="segmented-control grid grid-cols-5 rounded-lg border" role="group" aria-labelledby="dice-roller-free-size">
                    {dieSizes.map((size) => (
                        <button
                            key={size}
                            type="button"
                            className="font-display text-base! tabular-nums disabled:opacity-60"
                            data-state={freeDieSize === size ? "active" : "inactive"}
                            aria-pressed={freeDieSize === size}
                            disabled={rolling}
                            onClick={() => setFreeDieSize(size)}
                        >
                            d{size}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default FreeRollControls
