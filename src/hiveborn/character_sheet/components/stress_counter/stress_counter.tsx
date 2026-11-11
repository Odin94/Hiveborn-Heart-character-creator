import { resistances } from "@/hiveborn/game_data/resistances"
import { useCharacterStore } from "../../character_states"
import ProtectionsRow from "./protections_row"
import ResistanceRow from "./resistance_row"
import { Hint } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Dices } from "lucide-react"
import { type ReactNode, useState } from "react"
import { type Resistance } from "@/hiveborn/game_data/resistances"
import StressRollDialog from "./stress_roll_dialog"
import type { CharacterState } from "../../character_states"

type StressProtections = Pick<CharacterState, "stress" | "protections">

// Wide containers: name | track | protection on one line. Narrow: name + protection, track below.
const rowClassName = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-[3px] @md:grid-cols-[6.75rem_minmax(0,1fr)_auto] @md:gap-x-4"

const StressHeader = () => (
    <div className={cn(rowClassName, "hidden pb-0.5 @md:grid")} aria-hidden="true">
        <span />
        <span className="eyebrow">Stress</span>
        <span className="eyebrow">Protection</span>
    </div>
)

const StressRow = ({ name, track, protection }: { name: ReactNode; track: ReactNode; protection: ReactNode }) => (
    <div className={rowClassName}>
        {name}
        <div className="order-last col-span-2 min-w-0 @md:order-none @md:col-span-1">{track}</div>
        {protection}
    </div>
)

const StressCount = ({ value }: { value: number }) => (
    <span className={cn("text-xs font-semibold tabular-nums", value > 0 ? "text-heart" : "text-muted-foreground/70")}>{value}</span>
)

export const ReadOnlyStressCounter = ({ stress, protections }: StressProtections) => {
    return (
        <div className="@container space-y-1.5">
            <StressHeader />
            {resistances.map((resistance) => (
                <StressRow
                    key={resistance}
                    name={
                        <div className="flex h-6 min-w-0 items-baseline gap-1.5 pt-1">
                            <span className="font-display text-base leading-none font-bold tracking-[0.06em] uppercase">{resistance}</span>
                            <StressCount value={stress[resistance]} />
                        </div>
                    }
                    track={<ResistanceRow label={resistance} n={stress[resistance]} readOnly />}
                    protection={<ProtectionsRow label={resistance} n={protections[resistance]} readOnly />}
                />
            ))}
        </div>
    )
}

const StressCounter = () => {
    // TODOdin: Consider color-coding your resistances
    const stress = useCharacterStore.use.stress()
    const setStress = useCharacterStore.use.setStress()
    const protections = useCharacterStore.use.protections()
    const setProtections = useCharacterStore.use.setProtections()
    const [resistanceToRoll, setResistanceToRoll] = useState<Resistance | null>(null)
    const [stressRollInProgress, setStressRollInProgress] = useState(false)

    return (
        <div className="@container space-y-1.5" data-stress-counter="">
            <StressHeader />

            {resistances.map((resistance) => (
                <StressRow
                    key={resistance}
                    name={
                        <Hint
                            label={stressRollInProgress ? "A stress roll is still landing" : `Roll ${resistance} stress`}
                            side="left"
                            wrap={stressRollInProgress}
                        >
                            <button
                                type="button"
                                className="group/stress -mx-1.5 flex h-6 min-w-0 items-baseline gap-1.5 pt-1 @md:pt-1.5 justify-self-start rounded-md px-1.5 text-left transition-colors duration-150 ease-out hover:bg-accent disabled:opacity-60 @md:h-7"
                                aria-label={`Roll ${resistance} stress (${stress[resistance]} marked)`}
                                disabled={stressRollInProgress}
                                onClick={() => setResistanceToRoll(resistance)}
                            >
                                <span className="font-display text-base leading-none font-bold tracking-[0.06em] uppercase @md:text-[1.0625rem]">
                                    {resistance}
                                </span>
                                <StressCount value={stress[resistance]} />
                                <Dices
                                    className="size-3.5 shrink-0 text-muted-foreground/45 transition-colors duration-150 ease-out group-hover/stress:text-heart group-focus-visible/stress:text-heart"
                                    aria-hidden="true"
                                />
                            </button>
                        </Hint>
                    }
                    track={<ResistanceRow label={resistance} n={stress[resistance]} setN={(n) => setStress({ ...stress, [resistance]: n })} />}
                    protection={
                        <ProtectionsRow label={resistance} n={protections[resistance]} setN={(n) => setProtections({ ...protections, [resistance]: n })} />
                    }
                />
            ))}

            <StressRollDialog resistance={resistanceToRoll} onClose={() => setResistanceToRoll(null)} onRollingChange={setStressRollInProgress} />
        </div>
    )
}

export default StressCounter
