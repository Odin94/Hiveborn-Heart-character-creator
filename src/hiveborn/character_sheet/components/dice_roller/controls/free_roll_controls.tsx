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
    return (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
                Dice
                <input
                    type="number"
                    min={1}
                    max={maxFreeDiceCount}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                    value={freeDiceCount}
                    disabled={rolling}
                    onChange={(event) => {
                        const nextCount = Math.min(maxFreeDiceCount, Math.max(1, Number(event.target.value) || 1))
                        setFreeDiceCount(nextCount)
                    }}
                />
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
