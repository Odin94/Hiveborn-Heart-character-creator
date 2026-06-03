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
    const updateDiceCount = (count: number) => {
        const nextCount = Math.min(maxFreeDiceCount, Math.max(1, count))
        setFreeDiceCount(nextCount)
    }

    return (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
                Dice
                <div className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] overflow-hidden rounded-md border border-input bg-background text-foreground shadow-xs">
                    <button
                        type="button"
                        className="flex h-full items-center justify-center border-r border-red-900/20 bg-red-900 text-red-50 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-900/35 disabled:text-red-950/45"
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
                        className="flex h-full items-center justify-center border-l border-red-900/20 bg-red-900 text-red-50 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-900/35 disabled:text-red-950/45"
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
                <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                    value={freeDieSize}
                    disabled={rolling}
                    onChange={(event) => setFreeDieSize(Number(event.target.value) as DieSize)}
                >
                    {dieSizes.map((dieSize) => (
                        <option key={dieSize} value={dieSize}>
                            d{dieSize}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    )
}

export default FreeRollControls
