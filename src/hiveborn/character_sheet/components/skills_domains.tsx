import { Checkbox } from "@/components/ui/checkbox"
import { domainDescriptions, domains, iconByDomain } from "@/hiveborn/game_data/domains"
import { iconBySkill, skillDescriptions, skills } from "@/hiveborn/game_data/skills"
import type { ReactNode } from "react"
import { useCharacterStore } from "../character_states"
import { Domain, Skill } from "../../game_data/character"
import { useDiceRollerStore } from "../dice_roller_state"
import { SheetSection } from "./shared/sheet_section"
import SkillDomainTooltip from "./skill_domain_tooltip"

type TraitRowProps = {
    name: string
    icon: ReactNode
    description: string
    trained: boolean
    knacks: string
    isSelected: boolean
    onTrainedChange: (trained: boolean) => void
    onKnacksChange: (knacks: string) => void
    onSelect: () => void
}

/** One line of the track: ink box, the rollable name, and a ruled line for knacks. */
const TraitRow = ({ name, icon, description, trained, knacks, isSelected, onTrainedChange, onKnacksChange, onSelect }: TraitRowProps) => {
    const label = name.toUpperCase()
    return (
        <li className="trait-row" data-trained={trained ? "" : undefined} data-selected={isSelected ? "" : undefined}>
            <Checkbox checked={trained} aria-label={`${capitalize(name)}: trained`} onCheckedChange={(checked) => onTrainedChange(checked === true)} />
            <span className="flex min-w-0 items-center gap-1.5">
                <span className="trait-icon" aria-hidden="true">
                    {icon}
                </span>
                <SkillDomainTooltip description={description} isSelected={isSelected} label={label} onSelect={onSelect} />
            </span>
            <input className="trait-knack" aria-label={`${capitalize(name)} knacks`} value={knacks} onChange={(e) => onKnacksChange(e.target.value)} />
        </li>
    )
}

const SkillsDomains = () => {
    const existingSkills = useCharacterStore.use.skills()
    const setSkills = useCharacterStore.use.setSkills()
    const existingDomains = useCharacterStore.use.domains()
    const setDomains = useCharacterStore.use.setDomains()
    const selectedSkill = useDiceRollerStore.use.selectedSkill()
    const selectedDomain = useDiceRollerStore.use.selectedDomain()
    const pickSkill = useDiceRollerStore.use.pickSkill()
    const pickDomain = useDiceRollerStore.use.pickDomain()

    return (
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
            <SheetSection title="Skills" aside="Knacks">
                <ul className="trait-track">
                    {skills.map((skill) => {
                        const { hasSkill, knacks } = existingSkills[skill] ?? { hasSkill: false, knacks: "" }
                        return (
                            <TraitRow
                                key={skill}
                                name={skill}
                                icon={iconBySkill[skill]}
                                description={skillDescriptions[skill]}
                                trained={hasSkill}
                                knacks={knacks}
                                isSelected={selectedSkill === skill}
                                onSelect={() => pickSkill(skill)}
                                onTrainedChange={(checked) => setSkills({ ...existingSkills, [skill]: { hasSkill: checked, knacks } as Skill })}
                                onKnacksChange={(newKnacks) => setSkills({ ...existingSkills, [skill]: { hasSkill, knacks: newKnacks } as Skill })}
                            />
                        )
                    })}
                </ul>
            </SheetSection>

            <SheetSection title="Domains" aside="Knacks">
                <ul className="trait-track">
                    {domains.map((domain) => {
                        const { hasDomain, knacks } = existingDomains[domain] ?? { hasDomain: false, knacks: "" }
                        return (
                            <TraitRow
                                key={domain}
                                name={domain}
                                icon={iconByDomain[domain]}
                                description={domainDescriptions[domain]}
                                trained={hasDomain}
                                knacks={knacks}
                                isSelected={selectedDomain === domain}
                                onSelect={() => pickDomain(domain)}
                                onTrainedChange={(checked) => setDomains({ ...existingDomains, [domain]: { hasDomain: checked, knacks } as Domain })}
                                onKnacksChange={(newKnacks) => setDomains({ ...existingDomains, [domain]: { hasDomain, knacks: newKnacks } as Domain })}
                            />
                        )
                    })}
                </ul>
            </SheetSection>
        </div>
    )
}

const capitalize = (text: string) => `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`

export default SkillsDomains
