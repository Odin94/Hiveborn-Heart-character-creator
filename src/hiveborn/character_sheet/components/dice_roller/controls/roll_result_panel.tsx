import { RollResult } from "../types"

const RollResultPanel = ({ rolling, result }: { rolling: boolean; result: RollResult | null }) => {
    return (
        <div className="mt-4 flex h-32 items-center justify-center overflow-hidden rounded-md border border-red-900/20 bg-red-50/70 p-4 text-center">
            {rolling ? (
                <div className="heart-loading-dots" aria-label="Rolling dice">
                    <span />
                    <span />
                    <span />
                </div>
            ) : result ? (
                <div className="grid gap-1">
                    <div className="text-5xl font-black leading-none">{result.value}</div>
                    <div className="text-xl font-bold">{result.title}</div>
                    <div className="text-sm font-semibold text-red-900/75">{result.description}</div>
                </div>
            ) : (
                <div className="flex h-16 items-center justify-center text-sm font-semibold text-red-900/60">Ready</div>
            )}
        </div>
    )
}

export default RollResultPanel
