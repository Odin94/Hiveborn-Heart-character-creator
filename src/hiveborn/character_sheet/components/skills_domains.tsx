import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { domains } from "@/hiveborn/game_data/domains"
import { skills } from "@/hiveborn/game_data/skills"
import { Fragment } from "react/jsx-runtime"
import { useCharacterStore } from "../character_states"
import { Domain, Skill } from "../../game_data/character"
import { useDiceRollerStore } from "../dice_roller_state"
import { cn } from "@/lib/utils"

const SkillsDomains = () => {
    const existingSkills = useCharacterStore.use.skills()
    const setSkills = useCharacterStore.use.setSkills()
    const existingDomains = useCharacterStore.use.domains()
    const setDomains = useCharacterStore.use.setDomains()
    const selectedSkill = useDiceRollerStore.use.selectedSkill()
    const selectedDomain = useDiceRollerStore.use.selectedDomain()
    const pickSkill = useDiceRollerStore.use.pickSkill()
    const pickDomain = useDiceRollerStore.use.pickDomain()

    const rowCount = Math.max(skills.length, domains.length)

    const gridClass = "grid grid-cols-[minmax(0,1fr)_7rem] gap-2 text-left sm:grid-cols-4"
    return (
        <div className="space-y-2">
            <div className={gridClass}>
                <h2 className="text-lg font-bold">
                    <span className="sm:hidden">SKILLS / DOMAINS</span>
                    <span className="hidden sm:inline">SKILLS</span>
                </h2>
                <h2 className="text-lg font-bold text-red-900/60 ml-4">KNACKS</h2>
                <h2 className="hidden text-lg font-bold sm:block">DOMAINS</h2>
                <h2 className="hidden text-lg font-bold text-red-900/60 ml-4 sm:block">KNACKS</h2>
            </div>
            <div className={`text-black grid grid-cols-[minmax(0,1fr)_7rem] gap-1 gap-y-2 sm:grid-cols-4 sm:gap-y-0 grid-rows-${rowCount} size-full`}>
                {Array.from({ length: rowCount }).map((_, i) => {
                    const skill = skills[i]
                    const { hasSkill, knacks: skillKnacks } = existingSkills[skill] ?? { hasSkill: false, knacks: [] }

                    const domain = domains[i]
                    const { hasDomain, knacks: domainKnacks } = existingDomains[domain] ?? { hasDomain: false, knacks: [] }

                    const colClass = "flex items-center h-8"

                    return (
                        <Fragment key={skill + domain}>
                            {/* Skill + Knack */}
                            {skill ? (
                                <>
                                    <div className={`min-w-0 font-bold text-md text-left ${colClass}`}>
                                        <Checkbox
                                            checked={hasSkill}
                                            onCheckedChange={(checked) => {
                                                setSkills({
                                                    ...existingSkills,
                                                    [skill]: { hasSkill: checked, knacks: skillKnacks } as Skill,
                                                })
                                            }}
                                            className="mr-3"
                                        />
                                        <button
                                            type="button"
                                            className={cn(
                                                "min-w-0 rounded-sm px-1 text-left font-bold hover:bg-red-900/10",
                                                selectedSkill === skill && "bg-red-900 text-white hover:bg-red-900",
                                            )}
                                            onClick={() => pickSkill(skill)}
                                        >
                                            {skill.toUpperCase()}
                                        </button>
                                    </div>
                                    <div className={`ml-2 sm:ml-4 ${colClass}`}>
                                        <Input
                                            className="h-8 w-full text-sm sm:w-28"
                                            value={skillKnacks}
                                            onChange={(e) => {
                                                const newKnacks = e.target.value
                                                setSkills({
                                                    ...existingSkills,
                                                    [skill]: { hasSkill, knacks: newKnacks } as Skill,
                                                })
                                            }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div />
                            )}

                            {/* Domain + Knack */}
                            {domain ? (
                                <>
                                    <div className={`min-w-0 font-bold text-md text-left ${colClass}`}>
                                        <Checkbox
                                            checked={hasDomain}
                                            onCheckedChange={(checked) => {
                                                setDomains({
                                                    ...existingDomains,
                                                    [domain]: { hasDomain: checked, knacks: domainKnacks } as Domain,
                                                })
                                            }}
                                            className="mr-3"
                                        />
                                        <button
                                            type="button"
                                            className={cn(
                                                "min-w-0 rounded-sm px-1 text-left font-bold hover:bg-red-900/10",
                                                selectedDomain === domain && "bg-red-900 text-white hover:bg-red-900",
                                            )}
                                            onClick={() => pickDomain(domain)}
                                        >
                                            {domain.toUpperCase()}
                                        </button>
                                    </div>
                                    <div className={`ml-2 sm:ml-4 ${colClass}`}>
                                        <Input
                                            className="h-8 w-full text-sm sm:w-28"
                                            value={domainKnacks}
                                            onChange={(e) => {
                                                const newKnacks = e.target.value
                                                setDomains({
                                                    ...existingDomains,
                                                    [domain]: { hasDomain, knacks: newKnacks } as Domain,
                                                })
                                            }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div />
                            )}
                        </Fragment>
                    )
                })}
            </div>
        </div>
    )
}

export default SkillsDomains
