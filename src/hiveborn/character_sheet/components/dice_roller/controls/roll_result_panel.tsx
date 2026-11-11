import { HeartSigil } from "@/components/ui/sigil"
import { getRollOutcome, type RollOutcome } from "../outcome"
import { RollResult } from "../types"

// The Heart outcome ladder; spans match how many d10 faces land in each band.
const outcomeLadder: { outcome: RollOutcome; label: string; span: number }[] = [
    { outcome: "crit-fail", label: "1", span: 1 },
    { outcome: "fail", label: "2–5", span: 4 },
    { outcome: "cost", label: "6–7", span: 2 },
    { outcome: "success", label: "8–9", span: 2 },
    { outcome: "crit-success", label: "10", span: 1 },
]

const RollResultPanel = ({ rolling, result }: { rolling: boolean; result: RollResult | null }) => {
    const outcome = result && !rolling ? getRollOutcome(result.value) : null

    return (
        <div className="roll-readout" data-outcome={outcome ?? (rolling ? "rolling" : "idle")}>
            <div className="roll-readout-body" aria-live="polite">
                {rolling ? (
                    <div className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground" aria-label="Rolling dice">
                        <HeartSigil className="hb-heartbeat size-5 text-heart" />
                        Rolling…
                    </div>
                ) : result ? (
                    <div className="roll-readout-result">
                        <span className="roll-readout-value">{result.value}</span>
                        <div className="min-w-0">
                            <p className="roll-readout-title">{result.title}</p>
                            <p className="roll-readout-description">{result.description}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm font-semibold text-muted-foreground">Ready</p>
                )}
            </div>

            <ol className="roll-ladder" aria-hidden="true">
                {outcomeLadder.map((step) => (
                    <li
                        key={step.outcome}
                        className="roll-ladder-step"
                        data-outcome={step.outcome}
                        data-active={step.outcome === outcome || undefined}
                        style={{ flexGrow: step.span }}
                    >
                        {step.label}
                    </li>
                ))}
            </ol>
        </div>
    )
}

export default RollResultPanel
