import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { CharacterClass, characterClasses, coreTraitsByCharacter, isCharacterClass } from "@/hiveborn/game_data/classes"
import { useCharacterStore } from "../character_states"
import { Calling, callings, isCalling } from "@/hiveborn/game_data/callings"
import { abilitiesByClassOrCalling } from "@/hiveborn/game_data/abilities"
import { useApplyStaticBonuses } from "../hooks/useApplyStaticBonuses"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

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
    const applyStaticBonuses = useApplyStaticBonuses()

    const applyCoreTraits = ({ pickedEquipment }: { pickedEquipment: string }) => {
        if (isCharacterClass(characterClass)) {
            const coreTraits = coreTraitsByCharacter[characterClass]

            let newAbilities = abilities
            for (const coreAbility of [...coreTraits.abilities].reverse()) {
                if (!abilities.includes(`${coreAbility.name} - `)) {
                    newAbilities = `${coreAbility.name} - ${coreAbility.description}\n\n${newAbilities}`
                }
                applyStaticBonuses(coreAbility.staticBonuses)
            }
            setAbilities(newAbilities)

            let newEquipment = equipment
            for (const coreEquipment of [pickedEquipment, coreTraits.equipment]) {
                if (!equipment.includes(coreEquipment)) {
                    newEquipment = `${coreEquipment}\n\n${newEquipment}`
                }
            }
            setEquipment(newEquipment)

            existingSkills[coreTraits.skill].hasSkill = true
            setSkills({ ...existingSkills })
            existingDomains[coreTraits.domain].hasDomain = true
            setDomains({ ...existingDomains })

            setResources(`${coreTraits.resource}\n\n${resources}`)
        } else {
            console.log(`Not a correct character class: '${characterClass}'`)
        }
    }

    return (
        <div className="grid grid-cols-[1fr_6fr] gap-1 grid-rows-3 size-full">
            {/* Name */}
            <div className="flex items-center font-bold text-left">Name</div>
            <div className="flex items-center">
                <Input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "90%" }} />
            </div>

            {/* Class */}
            <div className="flex items-center font-bold text-left">Class</div>
            <div className="flex items-center">
                <Input value={characterClass} onChange={(e) => setCharacterClass(e.target.value)} style={{ width: "90%" }} />
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
                <Input value={calling} onChange={(e) => setCalling(e.target.value)} style={{ width: "90%" }} />
                <CallingDropdown
                    onSelect={(calling: Calling) => {
                        setCalling(calling)
                    }}
                    onConfirm={() => {
                        // TODOdin: Deal with people putting their ancestry in this field somehow
                        if (isCalling(calling)) {
                            const callingAbility = abilitiesByClassOrCalling[calling][0]
                            if (!abilities.includes(`${callingAbility.name} - `)) {
                                setAbilities(`${callingAbility.name} - ${callingAbility.description}\n\n${abilities}`)
                            }
                            applyStaticBonuses(callingAbility.staticBonuses)
                        } else {
                            console.log(`Not a correct calling: '${calling}'`)
                        }
                    }}
                />
            </div>
        </div>
    )
}

const ClassDropdown = ({ onSelect, onConfirm }: { onSelect: (text: CharacterClass) => void; onConfirm: (selection: { pickedEquipment: string }) => void }) => {
    const characterClass = useCharacterStore.use.characterClass()
    const coreTraits = isCharacterClass(characterClass) ? coreTraitsByCharacter[characterClass] : null
    const [pickedEquipmentIndex, setPickedEquipmentIndex] = useState("0")

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
                            <DropdownMenuItem onSelect={(_e) => onSelect(c)} key={c}>
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
                            <p className="text-muted-foreground text-md my-2">Resource: {coreTraits.resource}</p>

                            <p className="text-muted-foreground text-md my-2">
                                Abilities: {coreTraits.abilities.map((ability) => `'${ability.name}'`).join(", ")}
                            </p>

                            <p>Equipment:</p>
                            {coreTraits.equipment ? (
                                <>
                                    <p>{coreTraits.equipment}</p>
                                    <p>AND</p>
                                </>
                            ) : null}
                            <RadioGroup value={pickedEquipmentIndex} onValueChange={setPickedEquipmentIndex}>
                                {coreTraits.pickEquipment.map((pickEquipment, i) => (
                                    <div className="flex items-center space-x-2" key={pickEquipment}>
                                        <RadioGroupItem value={`${i}`} id={`${i}`} />
                                        <Label htmlFor={`${i}`}>{pickEquipment}</Label>
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
                                            onConfirm({ pickedEquipment: coreTraits.pickEquipment[Number(pickedEquipmentIndex)] })
                                            setPickedEquipmentIndex("0")
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

const CallingDropdown = ({ onSelect, onConfirm }: { onSelect: (text: Calling) => void; onConfirm: () => void }) => {
    const calling = useCharacterStore.use.calling()
    const callingAbility = isCalling(calling) ? abilitiesByClassOrCalling[calling][0] : null

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
                            <DropdownMenuItem onSelect={(_e) => onSelect(c)} key={c}>
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
                        <p className="text-muted-foreground text-md my-2">
                            '{callingAbility?.name}': {callingAbility?.description}
                        </p>
                        <div className="mt-2 flex justify-end">
                            <DialogClose asChild>
                                <Button type="button" variant="secondary" onClick={() => {}}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <DialogClose asChild>
                                <Button className="ml-3" type="button" onClick={onConfirm}>
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
