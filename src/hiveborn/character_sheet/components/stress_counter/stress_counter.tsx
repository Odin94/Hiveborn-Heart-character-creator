import { resistances } from "@/hiveborn/game_data/resistances"
import { useCharacterStore } from "../../character_states"
import ProtectionsRow from "./protections_row"
import ResistanceRow from "./resistance_row"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useState } from "react"
import { type Resistance } from "@/hiveborn/game_data/resistances"
import StressRollDialog from "./stress_roll_dialog"
import type { CharacterState } from "../../character_states"

type StressProtections = Pick<CharacterState, "stress" | "protections">

export const ReadOnlyStressCounter = ({ stress, protections }: StressProtections) => {
    const gridClass = "grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-left sm:grid-cols-[1fr_2fr_1fr] sm:gap-2"

    return (
        <div className="space-y-2">
            <div className={`${gridClass} hidden sm:grid`}>
                <div></div>
                <div></div>
                <div className="font-bold">PROTECTIONS</div>
            </div>

            {resistances.map((resistance) => (
                <div key={resistance} className={gridClass}>
                    <div className="font-bold">{resistance.toUpperCase()}</div>
                    <ResistanceRow n={stress[resistance]} readOnly />
                    <div className="col-start-2 sm:col-start-auto">
                        <ProtectionsRow n={protections[resistance]} readOnly />
                    </div>
                </div>
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

    const gridClass = "grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-left sm:grid-cols-[1fr_2fr_1fr] sm:gap-2"
    return (
        <div className="space-y-2">
            <div className={`${gridClass} hidden sm:grid`}>
                <div></div>
                <div></div>
                <div className="font-bold">PROTECTIONS</div>
            </div>

            {resistances.map((resistance) => (
                <div key={resistance} className={gridClass}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="text-left font-bold hover:underline focus-visible:underline disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={stressRollInProgress}
                                onClick={() => setResistanceToRoll(resistance)}
                            >
                                {resistance.toUpperCase()}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{`${resistance.toUpperCase()}: ${stress[resistance]}`}</p>
                        </TooltipContent>
                    </Tooltip>

                    <ResistanceRow n={stress[resistance]} setN={(n) => setStress({ ...stress, [resistance]: n })} />
                    <div className="col-start-2 sm:col-start-auto">
                        <ProtectionsRow n={protections[resistance]} setN={(n) => setProtections({ ...protections, [resistance]: n })} />
                    </div>
                </div>
            ))}

            <StressRollDialog resistance={resistanceToRoll} onClose={() => setResistanceToRoll(null)} onRollingChange={setStressRollInProgress} />
        </div>
    )
}

export default StressCounter
