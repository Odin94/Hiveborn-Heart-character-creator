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
import { formatEquipmentEntry, formatRulesText } from "../markdown_formatting"
import { CharacterClass, characterClasses, coreTraitsByCharacter } from "@/hiveborn/game_data/classes"
import { useCharacterStore } from "../character_states"
import { Calling, callings } from "@/hiveborn/game_data/callings"
import { abilitiesByClassOrCalling } from "@/hiveborn/game_data/abilities"
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
    const calling = useCharacterStore.use.calling()
    const setCalling = useCharacterStore.use.setCalling()

    return (
        <div className="grid w-full grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-[1fr_6fr]">
            {/* Name */}
            <div className="flex items-center font-bold text-left">Name</div>
            <div className="flex items-center">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
            </div>

            {/* Class */}
            <div className="flex items-center font-bold text-left">Class</div>
            <div className="relative flex items-center">
                <Input value={characterClass} onChange={(e) => setCharacterClass(e.target.value)} className="w-full pr-10" />
                <div className="absolute right-2">
                    <ClassDropdown />
                </div>
            </div>

            {/* Calling */}
            <div className="flex items-center font-bold text-left">Calling</div>
            <div className="relative flex items-center">
                <Input value={calling} onChange={(e) => setCalling(e.target.value)} className="w-full pr-10" />
                <div className="absolute right-2">
                    <CallingDropdown />
                </div>
            </div>
        </div>
    )
}

const ClassDropdown = () => {
    const [selection, setSelection] = useState<CharacterClass | null>(null)
    const [characterUuid, setCharacterUuid] = useState("")
    const coreTraits = selection ? coreTraitsByCharacter[selection] : null
    const [pickedEquipmentIndex, setPickedEquipmentIndex] = useState("0")

    return (
        <Dialog>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
                    <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Class</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {characterClasses.map((c) => (
                        <DialogTrigger asChild key={c}>
                            <DropdownMenuItem
                                onSelect={(_e) => {
                                    setSelection(c)
                                    setPickedEquipmentIndex("0")
                                    setCharacterUuid(useCharacterStore.getState().getCharacterData().uuid)
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
                    <DialogTitle>Apply {selection?.toUpperCase()} core traits?</DialogTitle>
                    <DialogDescription></DialogDescription>
                    {coreTraits ? (
                        // TODOdin: Make this Dialog pretty
                        <div>
                            <p className="text-muted-foreground text-md my-2">Skill: {coreTraits.skill.toUpperCase()}</p>
                            <p className="text-muted-foreground text-md my-2">Domain: {coreTraits.domain.toUpperCase()}</p>
                            <div className="text-muted-foreground text-md my-2">
                                Resource: <Markdown inline>{formatRulesText(coreTraits.resource)}</Markdown>
                            </div>

                            <div className="text-muted-foreground text-md my-2">
                                Abilities: <Markdown inline>{coreTraits.abilities.map((ability) => `\`${ability.name}\``).join(", ")}</Markdown>
                            </div>

                            <p className="mt-5 mb-3">Equipment:</p>
                            {coreTraits.equipment ? (
                                <>
                                    <Markdown>{formatEquipmentEntry(coreTraits.equipment)}</Markdown>
                                    <p className="my-3">AND</p>
                                </>
                            ) : null}
                            <RadioGroup className="gap-3" value={pickedEquipmentIndex} onValueChange={setPickedEquipmentIndex}>
                                {coreTraits.pickEquipment.map((pickEquipment, i) => (
                                    <div className="flex items-center space-x-2" key={pickEquipment}>
                                        <RadioGroupItem value={`${i}`} id={`${i}`} />
                                        <Label htmlFor={`${i}`}>
                                            <Markdown inline>{formatEquipmentEntry(pickEquipment)}</Markdown>
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>

                            <div className="mt-5 flex justify-end">
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
                                            if (selection)
                                                useCharacterStore
                                                    .getState()
                                                    .applyTraits(characterUuid, "class", selection, coreTraits.pickEquipment[Number(pickedEquipmentIndex)])
                                            setPickedEquipmentIndex("0")
                                            setSelection(null)
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

const CallingDropdown = () => {
    const [selection, setSelection] = useState<Calling | null>(null)
    const [characterUuid, setCharacterUuid] = useState("")
    const callingAbility = selection ? abilitiesByClassOrCalling[selection][0] : null

    return (
        <Dialog>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
                    <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Calling</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {callings.map((c) => (
                        <DialogTrigger asChild key={c}>
                            <DropdownMenuItem
                                onSelect={(_e) => {
                                    setSelection(c)
                                    setCharacterUuid(useCharacterStore.getState().getCharacterData().uuid)
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
                    <DialogTitle>Apply {selection?.toUpperCase()} stats?</DialogTitle>
                    <DialogDescription></DialogDescription>
                    <div>
                        <div className="text-muted-foreground text-md my-2">
                            {callingAbility ? <Markdown inline>{`\`${callingAbility.name}\`: ${formatRulesText(callingAbility.description)}`}</Markdown> : null}
                        </div>
                        <div className="mt-5 flex justify-end">
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
                                        if (selection) useCharacterStore.getState().applyTraits(characterUuid, "calling", selection)
                                        setSelection(null)
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
