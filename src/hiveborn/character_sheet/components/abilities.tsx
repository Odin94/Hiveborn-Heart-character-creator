import { Button } from "@/components/ui/button"
import { Hint } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Markdown } from "@/components/ui/markdown"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { abilitiesByClassOrCalling, Ability, comesWithPick, PickFromOption } from "@/hiveborn/game_data/abilities"
import { CharacterClass } from "@/hiveborn/game_data/classes"
import { iconByDomain } from "@/hiveborn/game_data/domains"
import { iconBySkill } from "@/hiveborn/game_data/skills"
import { formatRulesText, hasTitledEntry } from "@/hiveborn/character_sheet/markdown_formatting"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { BicepsFlexed, Check, Map as MapIcon, Shield } from "lucide-react"
import { Dispatch, SetStateAction, useState } from "react"
import { MdOutlineShield } from "react-icons/md"
import { useCharacterStore } from "../character_states"
import { DialogTriggerWrapper } from "./shared/DialogTriggerWrapper"
import { PickerEmpty, PickerList } from "./shared/picker"
import { SheetSection } from "./shared/sheet_section"

type PickingFromState = [Ability | undefined, Dispatch<SetStateAction<Ability | undefined>>]

const Abilities = ({ className }: { className?: string }) => {
    const abilities = useCharacterStore.use.abilities()
    const setAbilities = useCharacterStore.use.setAbilities()
    const characterClass = useCharacterStore.use.characterClass()
    const [pickingFromAbility, setPickingFromAbility] = useState<Ability>()

    return (
        <Dialog onOpenChange={(_open) => setPickingFromAbility(undefined)}>
            <SheetSection title="Abilities" className={className} action={<DialogTriggerWrapper label="Choose abilities" />}>
                {/* Fills whatever height its column gives it, never less than a comfortable reading block. */}
                <MarkdownTextarea
                    aria-label="Abilities"
                    value={abilities}
                    onChange={(e) => setAbilities(e.target.value)}
                    className="h-72 md:h-0 md:min-h-72 md:flex-1 lg:min-h-80"
                />
            </SheetSection>
            <AbilitiesDialog characterClass={characterClass} pickingFromState={[pickingFromAbility, setPickingFromAbility]} />
        </Dialog>
    )
}

const AbilitiesDialog = ({ characterClass, pickingFromState }: { characterClass: CharacterClass | string; pickingFromState: PickingFromState }) => {
    const [pickingFromAbility, setPickingFromAbility] = pickingFromState
    const [abilityType, setAbilityType] = useState("minor")
    const abilities = useCharacterStore.use.abilities()
    const applyProgression = useCharacterStore.use.applyProgression()

    const isAbilityPickedAlready = (ability: Ability) => hasTitledEntry(abilities, ability.name)
    // TODOdin: Consider just expecting characterClass.trim().lowercase() to include a CharacterClass instead of a match
    const abilityOptions = abilitiesByClassOrCalling[characterClass.trim() as unknown as CharacterClass] ?? []
    const filteredAbilityOptions =
        abilityType === "major"
            ? abilityOptions.filter(
                  (ability) => ability.type === "major" || (ability.type === "minor" && ability.parentName && !isAbilityPickedAlready(ability)),
              )
            : abilityOptions
                  .filter((ability) => ability.type === abilityType)
                  .filter((ability) => !ability.parentName)
                  .filter((ability) => !isAbilityPickedAlready(ability))
    const getIcon = ({ staticBonuses, pickFrom }: Ability) => {
        if (pickFrom.domains.length > 0) return <MapIcon />
        if (pickFrom.skills.length > 0) return <BicepsFlexed />
        if (pickFrom.protections.length > 0) return <Shield />

        if (staticBonuses.protections.length > 0) return <MdOutlineShield />

        let icons: React.ReactNode[] = []
        for (const domain of staticBonuses.domains) {
            icons.push(<span key={domain}>{iconByDomain[domain]}</span>)
        }
        for (const skill of staticBonuses.skills) {
            icons.push(<span key={skill}>{iconBySkill[skill]}</span>)
        }
        return icons
    }

    const hasIcon = (ability: Ability) => {
        const icon = getIcon(ability)
        return icon && (Array.isArray(icon) ? icon.length > 0 : true)
    }

    const renderAbilities = () => (
        <ScrollArea className="min-h-0 flex-1">
            {filteredAbilityOptions.length === 0 ? (
                <PickerEmpty>Every ability here is already on your sheet.</PickerEmpty>
            ) : (
                <PickerList>
                    {filteredAbilityOptions.map((ability) => {
                        const isAlreadyPickedMajor = ability.type === "major" && hasTitledEntry(abilities, ability.name)
                        return (
                            <button
                                key={ability.name}
                                type="button"
                                disabled={isAlreadyPickedMajor}
                                data-nested={ability.parentName ? "" : undefined}
                                className={cn("sheet-pick", ability.parentName && "ml-5 w-[calc(100%-1.25rem)]")}
                                onClick={() => {
                                    if (isAlreadyPickedMajor) return

                                    applyProgression({ type: "ability", ability })

                                    if (comesWithPick(ability)) {
                                        setPickingFromAbility(ability)
                                    }
                                }}
                            >
                                <span className="flex items-center gap-2">
                                    {hasIcon(ability) ? <span className="sheet-pick-icons">{getIcon(ability)}</span> : null}
                                    <span className="font-display text-lg leading-tight font-bold">{ability.name}</span>
                                    {isAlreadyPickedMajor ? (
                                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                            <Check className="size-3.5" /> On sheet
                                        </span>
                                    ) : null}
                                </span>

                                <Markdown className="mt-1 text-sm leading-relaxed text-muted-foreground">{formatRulesText(ability.description)}</Markdown>
                            </button>
                        )
                    })}
                </PickerList>
            )}
        </ScrollArea>
    )

    const hasOptions = abilityOptions.length > 0
    const classLabel = characterClass.trim()

    return (
        <DialogContent
            className={`flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:max-h-[calc(100dvh-2rem)] sm:w-[34rem] sm:max-w-[min(34rem,calc(100vw-2rem))] ${
                hasOptions ? "h-[calc(100dvh-1rem)] sm:h-[min(50rem,calc(100dvh-2rem))]" : "h-auto"
            }`}
        >
            <DialogHeader>
                <p className="eyebrow">{pickingFromAbility ? "Choose one" : "Abilities"}</p>
                <DialogTitle>{pickingFromAbility ? pickingFromAbility.name : classLabel ? `${classLabel} abilities` : "Abilities"}</DialogTitle>
                <DialogDescription className={hasOptions ? "sr-only" : ""}>
                    {hasOptions ? "Pick an ability to add it to your sheet." : "Pick one of the classes from the rulebook to choose abilities."}
                </DialogDescription>
            </DialogHeader>
            {!hasOptions ? null : pickingFromAbility ? (
                <PickFrom pickingFromState={[pickingFromAbility, setPickingFromAbility]} />
            ) : (
                <Tabs value={abilityType} onValueChange={setAbilityType} className="min-h-0 flex-1">
                    <TabsList variant="segmented" className="shrink-0">
                        <TabsTrigger value="minor">Minor</TabsTrigger>
                        <TabsTrigger value="major">Major</TabsTrigger>
                        <TabsTrigger value="zenith">Zenith</TabsTrigger>
                    </TabsList>

                    <TabsContent value="minor" className="flex flex-col">
                        {renderAbilities()}
                    </TabsContent>
                    <TabsContent value="major" className="flex flex-col">
                        {renderAbilities()}
                    </TabsContent>
                    <TabsContent value="zenith" className="flex flex-col">
                        {renderAbilities()}
                    </TabsContent>
                </Tabs>
            )}
        </DialogContent>
    )
}

const PickFrom = ({ pickingFromState }: { pickingFromState: PickingFromState }) => {
    const [pickingFromAbility, setPickingFromAbility] = pickingFromState
    const [selection, setSelection] = useState<PickFromOption>()
    const applyProgression = useCharacterStore.use.applyProgression()

    if (!pickingFromAbility || !comesWithPick(pickingFromAbility)) {
        setPickingFromAbility(undefined)
        console.warn(`Tried to render 'pickFrom' dialog with invalid ability: `, { pickingFrom: pickingFromAbility })
        return <p>Error: No ability with stats to pick from selected.</p>
    }

    const confirmSelection = () => {
        if (selection) applyProgression({ type: "pick", selection, ability: pickingFromAbility })

        setPickingFromAbility(undefined)
    }

    const options = [
        ...pickingFromAbility.pickFrom.domains.map((domain) => ({ value: domain, label: domain, icon: iconByDomain[domain] })),
        ...pickingFromAbility.pickFrom.skills.map((skill) => ({ value: skill, label: skill, icon: iconBySkill[skill] })),
        ...pickingFromAbility.pickFrom.protections.map((prot) => ({ value: prot, label: `+1 ${prot}`, icon: <Shield /> })),
    ]

    return (
        <div className="flex min-h-0 w-full flex-1 flex-col gap-5">
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={selection === option.value}
                        className="sheet-pick sheet-pick-option"
                        onClick={() => setSelection(option.value as PickFromOption)}
                    >
                        <span className="sheet-pick-icons">{option.icon}</span>
                        <span className="text-sm font-bold tracking-[0.08em] uppercase">{option.label}</span>
                    </button>
                ))}
            </div>

            <div className="mt-auto flex justify-end">
                <Hint label="Pick one of the options first" wrap disabled={Boolean(selection)}>
                    <Button disabled={!selection} onClick={confirmSelection}>
                        Confirm selection
                    </Button>
                </Hint>
            </div>
        </div>
    )
}

export default Abilities
