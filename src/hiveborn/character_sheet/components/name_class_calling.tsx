import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Markdown } from "@/components/ui/markdown"
import {
    formatEquipmentEntry,
    formatRulesText,
    hasTitledEntry,
    insertAbilityIntoText,
    removeEquipmentEntriesFromText,
    removeMarkdownEntriesFromText,
    removeTitledEntriesFromText,
} from "@/hiveborn/character_sheet/markdown_formatting"
import { CharacterClass, characterClasses, CoreTraits, coreTraitsByCharacter, isCharacterClass } from "@/hiveborn/game_data/classes"
import { useCharacterStore } from "../character_states"
import { Calling, callings, isCalling } from "@/hiveborn/game_data/callings"
import { abilitiesByClassOrCalling, StaticBonuses } from "@/hiveborn/game_data/abilities"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Domains, gainDomain, gainSkill, Skills } from "@/hiveborn/game_data/character"
import { DomainKey } from "@/hiveborn/game_data/domains"
import { protectionMaximum } from "../character_states"
import { Resistance } from "@/hiveborn/game_data/resistances"
import { SkillKey } from "@/hiveborn/game_data/skills"

const NameClassCalling = () => {
    const name = useCharacterStore.use.name()
    const setName = useCharacterStore.use.setName()
    const characterClass = useCharacterStore.use.characterClass()
    const setCharacterClass = useCharacterStore.use.setCharacterClass()
    const abilities = useCharacterStore.use.abilities()
    const setAbilities = useCharacterStore.use.setAbilities()
    const calling = useCharacterStore.use.calling()
    const setCalling = useCharacterStore.use.setCalling()
    const existingSkills = useCharacterStore.use.skills()
    const setSkills = useCharacterStore.use.setSkills()
    const existingDomains = useCharacterStore.use.domains()
    const setDomains = useCharacterStore.use.setDomains()
    const resources = useCharacterStore.use.resources()
    const setResources = useCharacterStore.use.setResources()
    const equipment = useCharacterStore.use.equipment()
    const setEquipment = useCharacterStore.use.setEquipment()
    const protections = useCharacterStore.use.protections()
    const setProtections = useCharacterStore.use.setProtections()

    const applyCoreTraits = ({ pickedEquipment, previousClass }: { pickedEquipment: string; previousClass: CharacterClass | null }) => {
        if (isCharacterClass(characterClass)) {
            const coreTraits = coreTraitsByCharacter[characterClass]
            const previousCoreTraits = previousClass ? coreTraitsByCharacter[previousClass] : null
            const callingAbility = getCallingAbility(calling)

            let newAbilities = previousCoreTraits
                ? removeTitledEntriesFromText(
                      abilities,
                      previousCoreTraits.abilities.map((ability) => ability.name),
                  )
                : abilities
            for (const coreAbility of coreTraits.abilities) {
                if (!hasTitledEntry(newAbilities, coreAbility.name)) {
                    newAbilities = insertAbilityIntoText(newAbilities, coreAbility)
                }
            }
            setAbilities(newAbilities)

            let newEquipment = previousCoreTraits
                ? removeEquipmentEntriesFromText(equipment, [previousCoreTraits.equipment, ...previousCoreTraits.pickEquipment].filter(Boolean))
                : equipment
            for (const coreEquipment of [pickedEquipment, coreTraits.equipment]) {
                if (!coreEquipment) continue

                const formattedEquipment = formatEquipmentEntry(coreEquipment)
                if (!newEquipment.includes(coreEquipment) && !newEquipment.includes(formattedEquipment)) {
                    newEquipment = `${formattedEquipment}\n\n${newEquipment}`
                }
            }
            setEquipment(newEquipment)

            let newResources = previousCoreTraits ? removeMarkdownEntriesFromText(resources, [previousCoreTraits.resource]) : resources
            const formattedResource = formatRulesText(coreTraits.resource)
            if (!newResources.includes(coreTraits.resource) && !newResources.includes(formattedResource)) {
                newResources = `${formattedResource}\n\n${newResources}`
            }
            setResources(newResources)

            const newSkills = copySkills(existingSkills)
            const newDomains = copyDomains(existingDomains)
            const newProtections = { ...protections }
            const callingBonuses = callingAbility?.staticBonuses ?? emptyStaticBonuses()

            if (previousCoreTraits) {
                removeClassBonusesFromDraft(newSkills, newDomains, newProtections, previousCoreTraits, callingBonuses)
            }
            applyClassBonusesToDraft(newSkills, newDomains, newProtections, coreTraits)
            setSkills(newSkills)
            setDomains(newDomains)
            setProtections(newProtections)
        } else {
            console.log(`Not a correct character class: '${characterClass}'`)
        }
    }

    return (
        <div className="grid size-full grid-cols-1 gap-1 sm:grid-cols-[1fr_6fr] sm:grid-rows-3">
            {/* Name */}
            <div className="flex items-center font-bold text-left">Name</div>
            <div className="flex items-center">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="sm:w-[90%]" />
            </div>

            {/* Class */}
            <div className="flex items-center font-bold text-left">Class</div>
            <div className="flex items-center">
                <Input value={characterClass} onChange={(e) => setCharacterClass(e.target.value)} className="sm:w-[90%]" />
                <ClassDropdown
                    onSelect={(characterClass: CharacterClass) => {
                        setCharacterClass(characterClass)
                    }}
                    onConfirm={applyCoreTraits}
                />
            </div>

            {/* Calling */}
            <div className="flex items-center font-bold text-left">Calling</div>
            <div className="flex items-center">
                <Input value={calling} onChange={(e) => setCalling(e.target.value)} className="sm:w-[90%]" />
                <CallingDropdown
                    onSelect={(calling: Calling) => {
                        setCalling(calling)
                    }}
                    onConfirm={({ previousCalling }) => {
                        // TODOdin: Deal with people putting their ancestry in this field somehow
                        if (isCalling(calling)) {
                            const callingAbility = abilitiesByClassOrCalling[calling][0]
                            const previousCallingAbility = previousCalling ? abilitiesByClassOrCalling[previousCalling][0] : null
                            let newAbilities = previousCallingAbility ? removeTitledEntriesFromText(abilities, [previousCallingAbility.name]) : abilities
                            if (!hasTitledEntry(newAbilities, callingAbility.name)) {
                                newAbilities = insertAbilityIntoText(newAbilities, callingAbility)
                            }
                            setAbilities(newAbilities)

                            const newSkills = copySkills(existingSkills)
                            const newDomains = copyDomains(existingDomains)
                            const newProtections = { ...protections }
                            const classTraits = isCharacterClass(characterClass) ? coreTraitsByCharacter[characterClass] : null

                            if (previousCallingAbility) {
                                removeStaticBonusesFromDraft(
                                    newSkills,
                                    newDomains,
                                    newProtections,
                                    previousCallingAbility.staticBonuses,
                                    getClassProvidedBonuses(classTraits),
                                )
                            }
                            applyStaticBonusesToDraft(newSkills, newDomains, newProtections, callingAbility.staticBonuses)
                            setSkills(newSkills)
                            setDomains(newDomains)
                            setProtections(newProtections)
                        } else {
                            console.log(`Not a correct calling: '${calling}'`)
                        }
                    }}
                />
            </div>
        </div>
    )
}

const ClassDropdown = ({
    onSelect,
    onConfirm,
}: {
    onSelect: (text: CharacterClass) => void
    onConfirm: (selection: { pickedEquipment: string; previousClass: CharacterClass | null }) => void
}) => {
    const characterClass = useCharacterStore.use.characterClass()
    const coreTraits = isCharacterClass(characterClass) ? coreTraitsByCharacter[characterClass] : null
    const [pickedEquipmentIndex, setPickedEquipmentIndex] = useState("0")
    const [previousClass, setPreviousClass] = useState<CharacterClass | null>(null)

    return (
        <Dialog>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="hover:bg-accent">
                    <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Class</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {characterClasses.map((c) => (
                        <DialogTrigger asChild key={c}>
                            <DropdownMenuItem
                                onSelect={(_e) => {
                                    setPreviousClass(isCharacterClass(characterClass) ? characterClass : null)
                                    onSelect(c)
                                }}
                                key={c}
                            >
                                {c}
                            </DropdownMenuItem>
                        </DialogTrigger>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Apply {characterClass.toUpperCase()} core traits?</DialogTitle>
                    <DialogDescription></DialogDescription>
                    {coreTraits ? (
                        // TODOdin: Make this Dialog pretty
                        <div>
                            <p className="text-muted-foreground text-md my-2">Skill: {coreTraits.skill.toUpperCase()}</p>
                            <p className="text-muted-foreground text-md my-2">Domain: {coreTraits.domain.toUpperCase()}</p>
                            <div className="text-muted-foreground text-md my-2">
                                Resource: <Markdown inline>{formatRulesText(coreTraits.resource)}</Markdown>
                            </div>

                            <p className="text-muted-foreground text-md my-2">
                                Abilities: <Markdown inline>{coreTraits.abilities.map((ability) => `\`${ability.name}\``).join(", ")}</Markdown>
                            </p>

                            <p>Equipment:</p>
                            {coreTraits.equipment ? (
                                <>
                                    <Markdown>{formatEquipmentEntry(coreTraits.equipment)}</Markdown>
                                    <p>AND</p>
                                </>
                            ) : null}
                            <RadioGroup value={pickedEquipmentIndex} onValueChange={setPickedEquipmentIndex}>
                                {coreTraits.pickEquipment.map((pickEquipment, i) => (
                                    <div className="flex items-center space-x-2" key={pickEquipment}>
                                        <RadioGroupItem value={`${i}`} id={`${i}`} />
                                        <Label htmlFor={`${i}`}>
                                            <Markdown inline>{formatEquipmentEntry(pickEquipment)}</Markdown>
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>

                            <div className="mt-2 flex justify-end">
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary" onClick={() => {}}>
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <DialogClose asChild>
                                    <Button
                                        className="ml-3"
                                        type="button"
                                        onClick={() => {
                                            onConfirm({ pickedEquipment: coreTraits.pickEquipment[Number(pickedEquipmentIndex)], previousClass })
                                            setPickedEquipmentIndex("0")
                                            setPreviousClass(null)
                                        }}
                                    >
                                        Apply
                                    </Button>
                                </DialogClose>
                            </div>
                        </div>
                    ) : null}
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

const CallingDropdown = ({
    onSelect,
    onConfirm,
}: {
    onSelect: (text: Calling) => void
    onConfirm: (selection: { previousCalling: Calling | null }) => void
}) => {
    const calling = useCharacterStore.use.calling()
    const callingAbility = isCalling(calling) ? abilitiesByClassOrCalling[calling][0] : null
    const [previousCalling, setPreviousCalling] = useState<Calling | null>(null)

    return (
        <Dialog>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="hover:bg-accent">
                    <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Calling</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {callings.map((c) => (
                        <DialogTrigger asChild key={c}>
                            <DropdownMenuItem
                                onSelect={(_e) => {
                                    setPreviousCalling(isCalling(calling) ? calling : null)
                                    onSelect(c)
                                }}
                                key={c}
                            >
                                {c}
                            </DropdownMenuItem>
                        </DialogTrigger>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Apply {calling.toUpperCase()} stats?</DialogTitle>
                    <DialogDescription></DialogDescription>
                    <div>
                        <div className="text-muted-foreground text-md my-2">
                            {callingAbility ? <Markdown inline>{`\`${callingAbility.name}\`: ${formatRulesText(callingAbility.description)}`}</Markdown> : null}
                        </div>
                        <div className="mt-2 flex justify-end">
                            <DialogClose asChild>
                                <Button type="button" variant="secondary" onClick={() => {}}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <DialogClose asChild>
                                <Button
                                    className="ml-3"
                                    type="button"
                                    onClick={() => {
                                        onConfirm({ previousCalling })
                                        setPreviousCalling(null)
                                    }}
                                >
                                    Apply
                                </Button>
                            </DialogClose>
                        </div>
                    </div>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

export default NameClassCalling

const emptyStaticBonuses = (): StaticBonuses => ({ domains: [], skills: [], protections: [] })

const getCallingAbility = (calling: string) => {
    return isCalling(calling) ? abilitiesByClassOrCalling[calling][0] : null
}

const copySkills = (skills: Skills): Skills => {
    return Object.fromEntries(Object.entries(skills).map(([skill, value]) => [skill, { ...value }])) as Skills
}

const copyDomains = (domains: Domains): Domains => {
    return Object.fromEntries(Object.entries(domains).map(([domain, value]) => [domain, { ...value }])) as Domains
}

const applyClassBonusesToDraft = (skills: Skills, domains: Domains, protections: Record<Resistance, number>, coreTraits: CoreTraits) => {
    skills[coreTraits.skill] = gainSkill(skills[coreTraits.skill])
    domains[coreTraits.domain] = gainDomain(domains[coreTraits.domain])

    for (const ability of coreTraits.abilities) {
        applyStaticBonusesToDraft(skills, domains, protections, ability.staticBonuses)
    }
}

const removeClassBonusesFromDraft = (
    skills: Skills,
    domains: Domains,
    protections: Record<Resistance, number>,
    coreTraits: CoreTraits,
    preservedBonuses: StaticBonuses,
) => {
    if (!preservedBonuses.skills.includes(coreTraits.skill)) {
        skills[coreTraits.skill].hasSkill = false
    }
    if (!preservedBonuses.domains.includes(coreTraits.domain)) {
        domains[coreTraits.domain].hasDomain = false
    }

    for (const ability of coreTraits.abilities) {
        removeStaticBonusesFromDraft(skills, domains, protections, ability.staticBonuses, preservedBonuses)
    }
}

const applyStaticBonusesToDraft = (skills: Skills, domains: Domains, protections: Record<Resistance, number>, bonuses: StaticBonuses) => {
    for (const skill of bonuses.skills) {
        skills[skill] = gainSkill(skills[skill])
    }

    for (const domain of bonuses.domains) {
        domains[domain] = gainDomain(domains[domain])
    }

    for (const { resistance, amount } of bonuses.protections) {
        protections[resistance] = Math.min(protections[resistance] + amount, protectionMaximum)
    }
}

const removeStaticBonusesFromDraft = (
    skills: Skills,
    domains: Domains,
    protections: Record<Resistance, number>,
    bonuses: StaticBonuses,
    preservedBonuses: StaticBonuses,
) => {
    const preservedSkills = new Set<SkillKey>(preservedBonuses.skills)
    const preservedDomains = new Set<DomainKey>(preservedBonuses.domains)
    const preservedProtections = new Set<Resistance>(preservedBonuses.protections.map(({ resistance }) => resistance))

    for (const skill of bonuses.skills) {
        if (!preservedSkills.has(skill)) {
            skills[skill].hasSkill = false
        }
    }

    for (const domain of bonuses.domains) {
        if (!preservedDomains.has(domain)) {
            domains[domain].hasDomain = false
        }
    }

    for (const { resistance, amount } of bonuses.protections) {
        if (!preservedProtections.has(resistance)) {
            protections[resistance] = Math.max(0, protections[resistance] - amount)
        }
    }
}

const getClassProvidedBonuses = (coreTraits: CoreTraits | null): StaticBonuses => {
    if (!coreTraits) return emptyStaticBonuses()

    return {
        skills: [coreTraits.skill, ...coreTraits.abilities.flatMap((ability) => ability.staticBonuses.skills)],
        domains: [coreTraits.domain, ...coreTraits.abilities.flatMap((ability) => ability.staticBonuses.domains)],
        protections: coreTraits.abilities.flatMap((ability) => ability.staticBonuses.protections),
    }
}
