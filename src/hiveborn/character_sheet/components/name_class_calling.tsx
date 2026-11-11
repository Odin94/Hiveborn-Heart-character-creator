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
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { iconByDomain } from "@/hiveborn/game_data/domains"
import { iconBySkill } from "@/hiveborn/game_data/skills"
import { Button, buttonVariants } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { type ReactNode, useId, useState } from "react"
import { ChevronDown } from "lucide-react"

export const CHARACTER_NAME_INPUT_ID = "character-name"

const NameClassCalling = () => {
    const name = useCharacterStore.use.name()
    const setName = useCharacterStore.use.setName()
    const characterClass = useCharacterStore.use.characterClass()
    const setCharacterClass = useCharacterStore.use.setCharacterClass()
    const calling = useCharacterStore.use.calling()
    const setCalling = useCharacterStore.use.setCalling()

    return (
        <div className="grid w-full grid-cols-2 gap-x-4 gap-y-4 text-left sm:gap-x-5">
            <div className="col-span-2 grid gap-1">
                <label htmlFor={CHARACTER_NAME_INPUT_ID} className="eyebrow">
                    Name
                </label>
                <Input
                    id={CHARACTER_NAME_INPUT_ID}
                    aria-label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Unnamed delver"
                    autoComplete="off"
                    spellCheck={false}
                    className="dossier-name h-14 rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 font-display text-[2.125rem] leading-none font-bold shadow-none sm:h-16 sm:text-[2.625rem]"
                />
            </div>

            <IdentityField label="Class" value={characterClass} onChange={setCharacterClass} dropdown={<ClassDropdown />} />
            <IdentityField label="Calling" value={calling} onChange={setCalling} dropdown={<CallingDropdown />} />
        </div>
    )
}

const IdentityField = ({ label, value, onChange, dropdown }: { label: string; value: string; onChange: (value: string) => void; dropdown: ReactNode }) => {
    const id = useId()
    return (
        <div className="grid min-w-0 gap-1">
            <label htmlFor={id} className="eyebrow">
                {label}
            </label>
            <div className="relative flex items-center">
                <Input
                    id={id}
                    aria-label={label}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete="off"
                    className="h-10 rounded-none border-0 border-b border-border-strong bg-transparent pr-10 pl-0 font-display text-xl font-semibold shadow-none sm:text-xl"
                />
                <div className="absolute right-0">{dropdown}</div>
            </div>
        </div>
    )
}

const ClassDropdown = () => {
    const [selection, setSelection] = useState<CharacterClass | null>(null)
    const [characterUuid, setCharacterUuid] = useState("")
    const coreTraits = selection ? coreTraitsByCharacter[selection] : null
    const [pickedEquipmentIndex, setPickedEquipmentIndex] = useState("0")
    const radioPrefix = useId()

    return (
        <Dialog>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                    aria-label="Choose class"
                    className={buttonVariants({
                        variant: "ghost",
                        size: "icon-sm",
                        className: "text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground",
                    })}
                >
                    <ChevronDown className="transition-transform duration-200 ease-out in-data-[state=open]:rotate-180" />
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
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <p className="eyebrow">Class</p>
                    <DialogTitle>Apply {selection} core traits?</DialogTitle>
                    <DialogDescription className="sr-only">Adds the class skill, domain, resource, abilities and equipment to your sheet.</DialogDescription>
                </DialogHeader>
                {coreTraits ? (
                    <div className="grid gap-5">
                        <dl className="trait-ledger">
                            <div>
                                <dt>Skill</dt>
                                <dd className="flex items-center gap-2 capitalize">
                                    <span className="trait-icon">{iconBySkill[coreTraits.skill]}</span>
                                    {coreTraits.skill}
                                </dd>
                            </div>
                            <div>
                                <dt>Domain</dt>
                                <dd className="flex items-center gap-2 capitalize">
                                    <span className="trait-icon">{iconByDomain[coreTraits.domain]}</span>
                                    {coreTraits.domain}
                                </dd>
                            </div>
                            <div>
                                <dt>Resource</dt>
                                <dd>
                                    <Markdown inline>{formatRulesText(coreTraits.resource)}</Markdown>
                                </dd>
                            </div>
                            <div>
                                <dt>Abilities</dt>
                                <dd>
                                    <Markdown inline>{coreTraits.abilities.map((ability) => `\`${ability.name}\``).join(", ")}</Markdown>
                                </dd>
                            </div>
                        </dl>

                        <div className="grid gap-2.5">
                            <p className="eyebrow">Equipment</p>
                            {coreTraits.equipment ? (
                                <div className="rounded-md border border-border bg-sunken px-3 py-2.5 text-sm">
                                    <Markdown>{formatEquipmentEntry(coreTraits.equipment)}</Markdown>
                                </div>
                            ) : null}
                            {coreTraits.equipment ? (
                                <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">and one of</p>
                            ) : null}
                            <RadioGroup className="gap-2" value={pickedEquipmentIndex} onValueChange={setPickedEquipmentIndex}>
                                {coreTraits.pickEquipment.map((pickEquipment, i) => (
                                    <Label
                                        key={pickEquipment}
                                        htmlFor={`${radioPrefix}-${i}`}
                                        className="sheet-pick sheet-pick-radio font-normal"
                                        data-checked={pickedEquipmentIndex === `${i}` ? "" : undefined}
                                    >
                                        <RadioGroupItem value={`${i}`} id={`${radioPrefix}-${i}`} />
                                        <span className="text-sm leading-snug">
                                            <Markdown inline>{formatEquipmentEntry(pickEquipment)}</Markdown>
                                        </span>
                                    </Label>
                                ))}
                            </RadioGroup>
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <DialogClose asChild>
                                <Button
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
                        </DialogFooter>
                    </div>
                ) : null}
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
                <DropdownMenuTrigger
                    aria-label="Choose calling"
                    className={buttonVariants({
                        variant: "ghost",
                        size: "icon-sm",
                        className: "text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground",
                    })}
                >
                    <ChevronDown className="transition-transform duration-200 ease-out in-data-[state=open]:rotate-180" />
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <p className="eyebrow">Calling</p>
                    <DialogTitle>Apply the {selection} calling?</DialogTitle>
                    <DialogDescription className="sr-only">Adds the calling's core ability to your sheet.</DialogDescription>
                </DialogHeader>
                {callingAbility ? (
                    <div className="rounded-md border border-border bg-sunken px-4 py-3 text-left">
                        <p className="font-display text-lg leading-tight font-bold">{callingAbility.name}</p>
                        <Markdown className="mt-1 text-sm leading-relaxed text-muted-foreground">{formatRulesText(callingAbility.description)}</Markdown>
                    </div>
                ) : null}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancel
                        </Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button
                            type="button"
                            onClick={() => {
                                if (selection) useCharacterStore.getState().applyTraits(characterUuid, "calling", selection)
                                setSelection(null)
                            }}
                        >
                            Apply
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default NameClassCalling
