import { RollResult } from "../types"

const RollResultPanel = ({ rolling, result }: { rolling: boolean; result: RollResult | null }) => {
    return (
        <div className="mt-4 flex h-32 items-center justify-center overflow-hidden rounded-md border border-primary/25 bg-muted p-4 text-center">
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
                    <div className="text-sm font-semibold text-primary/80">{result.description}</div>
                </div>
            ) : (
                <div className="flex h-16 items-center justify-center text-sm font-semibold text-primary/70">Ready</div>
            )}
        </div>
    )
}

export default RollResultPanel
