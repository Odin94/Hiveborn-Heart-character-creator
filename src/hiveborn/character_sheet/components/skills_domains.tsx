import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { domains } from "@/hiveborn/game_data/domains"
import { skills } from "@/hiveborn/game_data/skills"
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

    const mobileGridClass = "grid grid-cols-[minmax(0,1fr)_7rem] gap-2 text-left"
    const desktopGridClass = "hidden text-left sm:grid sm:grid-cols-4 sm:gap-2"
    const desktopColClass = "flex items-center h-8"
    const mobileColClass = "flex h-8 min-w-0 items-center"

    const renderSkill = (skill: (typeof skills)[number], colClass: string) => {
        const { hasSkill, knacks: skillKnacks } = existingSkills[skill] ?? { hasSkill: false, knacks: [] }

        return (
            <>
                <div className={`font-bold text-md text-left ${colClass}`}>
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
                <div className={`ml-2 ${colClass} sm:ml-4`}>
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
        )
    }

    const renderDomain = (domain: (typeof domains)[number], colClass: string) => {
        const { hasDomain, knacks: domainKnacks } = existingDomains[domain] ?? { hasDomain: false, knacks: [] }

        return (
            <>
                <div className={`font-bold text-md text-left ${colClass}`}>
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
                <div className={`ml-2 ${colClass} sm:ml-4`}>
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
        )
    }

    return (
        <div className="space-y-2">
            <div className="space-y-6 sm:hidden">
                <div className="space-y-2">
                    <div className={mobileGridClass}>
                        <h2 className="text-lg font-bold">SKILLS</h2>
                        <h2 className="text-lg font-bold text-red-900/60 ml-4">KNACKS</h2>
                    </div>
                    <div className={`${mobileGridClass} gap-y-2 text-foreground`}>
                        {skills.map((skill) => (
                            <div key={skill} className="contents">
                                {renderSkill(skill, mobileColClass)}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className={mobileGridClass}>
                        <h2 className="text-lg font-bold">DOMAINS</h2>
                        <h2 className="text-lg font-bold text-red-900/60 ml-4">KNACKS</h2>
                    </div>
                    <div className={`${mobileGridClass} gap-y-2 text-foreground`}>
                        {domains.map((domain) => (
                            <div key={domain} className="contents">
                                {renderDomain(domain, mobileColClass)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className={desktopGridClass}>
                <h2 className="text-lg font-bold">SKILLS</h2>
                <h2 className="text-lg font-bold text-red-900/60 ml-4">KNACKS</h2>
                <h2 className="text-lg font-bold">DOMAINS</h2>
                <h2 className="text-lg font-bold text-red-900/60 ml-4">KNACKS</h2>
            </div>
            <div className={`hidden text-foreground sm:grid sm:grid-cols-4 sm:gap-1 sm:gap-y-0 grid-rows-${rowCount} size-full`}>
                {Array.from({ length: rowCount }).map((_, i) => {
                    const skill = skills[i]
                    const domain = domains[i]

                    return (
                        <div key={skill + domain} className="contents">
                            {/* Skill + Knack */}
                            {skill ? renderSkill(skill, desktopColClass) : <div />}

                            {/* Domain + Knack */}
                            {domain ? renderDomain(domain, desktopColClass) : <div />}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default SkillsDomains
