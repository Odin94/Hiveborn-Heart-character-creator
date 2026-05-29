import { resistances } from "@/hiveborn/game_data/resistances"
import { useCharacterStore } from "../../character_states"
import ProtectionsRow from "./protections_row"
import ResistanceRow from "./resistance_row"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const StressCounter = () => {
    // TODOdin: Consider color-coding your resistances
    const stress = useCharacterStore.use.stress()
    const setStress = useCharacterStore.use.setStress()
    const protections = useCharacterStore.use.protections()
    const setProtections = useCharacterStore.use.setProtections()

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
                        <TooltipTrigger className="text-left">
                            <div className="font-bold">{resistance.toUpperCase()}</div>
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
        </div>
    )
}

export default StressCounter
