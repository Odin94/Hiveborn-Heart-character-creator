import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Markdown } from "@/components/ui/markdown"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { abilitiesByClassOrCalling, Ability, comesWithPick, PickFromOption } from "@/hiveborn/game_data/abilities"
import { CharacterClass } from "@/hiveborn/game_data/classes"
import { iconByDomain } from "@/hiveborn/game_data/domains"
import { iconBySkill } from "@/hiveborn/game_data/skills"
import { formatRulesText, hasTitledEntry, insertAbilityIntoText } from "@/hiveborn/character_sheet/markdown_formatting"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs"
import { Dispatch, SetStateAction, useState } from "react"
import { MdOutlineShield } from "react-icons/md"
import { useCharacterStore } from "../character_states"
import { useApplyPickedBonus } from "../hooks/useApplyPickedBonus"
import { useApplyStaticBonuses } from "../hooks/useApplyStaticBonuses"
import { DialogTriggerWrapper } from "./shared/DialogTriggerWrapper"

type PickingFromState = [Ability | undefined, Dispatch<SetStateAction<Ability | undefined>>]

const Abilities = () => {
    const abilities = useCharacterStore.use.abilities()
    const setAbilities = useCharacterStore.use.setAbilities()
    const characterClass = useCharacterStore.use.characterClass()
    const [pickingFromAbility, setPickingFromAbility] = useState<Ability>()

    return (
        <div>
            <div className="row-span-3 col-span-2 text-left mt-2">
                <Dialog onOpenChange={(_open) => setPickingFromAbility(undefined)}>
                    <h2 className="relative font-bold py-2 bg-red-900 text-white pl-3">
                        ABILITIES <DialogTriggerWrapper />
                    </h2>
                    <AbilitiesDialog characterClass={characterClass} pickingFromState={[pickingFromAbility, setPickingFromAbility]} />
                </Dialog>

                <MarkdownTextarea value={abilities} onChange={(e) => setAbilities(e.target.value)} className="h-80 sm:h-142" />
            </div>
        </div>
    )
}

const AbilitiesDialog = ({ characterClass, pickingFromState }: { characterClass: CharacterClass | string; pickingFromState: PickingFromState }) => {
    const [pickingFromAbility, setPickingFromAbility] = pickingFromState
    const [abilityType, setAbilityType] = useState("minor")
    const abilities = useCharacterStore.use.abilities()
    const setAbilities = useCharacterStore.use.setAbilities()
    const applyStaticBonuses = useApplyStaticBonuses()

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
    const selectedClassName = "border-b-0"

    const getIcon = ({ staticBonuses, pickFrom }: Ability) => {
        if (pickFrom.domains.length > 0) return "🗺️ "
        if (pickFrom.skills.length > 0) return "💪 "
        if (pickFrom.protections.length > 0) return "🛡️ "

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
        <ScrollArea className="min-h-0 flex-1" style={{ borderColor: "red" }}>
            {filteredAbilityOptions.map((ability) => {
                const isAlreadyPickedMajor = ability.type === "major" && hasTitledEntry(abilities, ability.name)
                return (
                    <div
                        key={ability.name}
                        className={`border-1 p-2 border-t-0
                            ${ability.parentName ? "ml-6" : ""}
                            ${isAlreadyPickedMajor ? "border border-[#999999] bg-[#eee] text-[#888] hover:bg-[#eee]" : "cursor-pointer hover:bg-accent"}
                        `}
                        onClick={() => {
                            if (isAlreadyPickedMajor) return

                            setAbilities(insertAbilityIntoText(abilities, ability))
                            applyStaticBonuses(ability.staticBonuses)

                            if (comesWithPick(ability)) {
                                setPickingFromAbility(ability)
                            }
                        }}
                    >
                        <h2 className="flex items-center">
                            {getIcon(ability)}
                            <span className={hasIcon(ability) ? "ml-2" : ""}>{`${ability.name}`}</span>
                        </h2>

                        <Markdown className="text-muted-foreground text-sm">{formatRulesText(ability.description)}</Markdown>
                    </div>
                )
            })}
        </ScrollArea>
    )

    return (
        <DialogContent
            className={`${abilityOptions.length === 0 ? "max-sm:h-auto" : "h-[calc(100dvh-1rem)]"} flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:h-[min(50rem,calc(100dvh-2rem))] sm:max-h-[calc(100vh-2rem)] sm:w-112`}
        >
            <DialogHeader className="min-h-0 flex-1 overflow-hidden">
                <DialogTitle>{pickingFromAbility ? pickingFromAbility.name.toUpperCase() : `${characterClass.toUpperCase()} ABILITIES`}</DialogTitle>
                <DialogDescription></DialogDescription>
                {abilityOptions.length === 0 ? (
                    <p>Pick a pre-defined class to select abilities</p>
                ) : pickingFromAbility ? (
                    <PickFrom pickingFromState={[pickingFromAbility, setPickingFromAbility]} />
                ) : (
                    <Tabs
                        defaultValue="minor"
                        className="flex min-h-0 w-full flex-1 flex-col p-1 sm:w-[400px] sm:p-2"
                        value={abilityType}
                        onValueChange={setAbilityType}
                    >
                        <TabsList className="grid w-full shrink-0 grid-cols-3">
                            <TabsTrigger value="minor" className={`border-1 ${abilityType === "minor" ? selectedClassName : ""}`}>
                                Minor
                            </TabsTrigger>
                            <TabsTrigger value="major" className={`border-1 ${abilityType === "major" ? selectedClassName : ""}`}>
                                Major
                            </TabsTrigger>
                            <TabsTrigger value="zenith" className={`border-1 ${abilityType === "zenith" ? selectedClassName : ""}`}>
                                Zenith
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="minor" className="flex min-h-0 flex-1 flex-col">
                            {renderAbilities()}
                        </TabsContent>
                        <TabsContent value="major" className="flex min-h-0 flex-1 flex-col">
                            {renderAbilities()}
                        </TabsContent>
                        <TabsContent value="zenith" className="flex min-h-0 flex-1 flex-col">
                            {renderAbilities()}
                        </TabsContent>
                    </Tabs>
                )}
            </DialogHeader>
        </DialogContent>
    )
}

const PickFrom = ({ pickingFromState }: { pickingFromState: PickingFromState }) => {
    const [pickingFromAbility, setPickingFromAbility] = pickingFromState
    const [selection, setSelection] = useState<PickFromOption>()
    const applyPickedBonus = useApplyPickedBonus()

    if (!pickingFromAbility || !comesWithPick(pickingFromAbility)) {
        setPickingFromAbility(undefined)
        console.warn(`Tried to render 'pickFrom' dialog with invalid ability: `, { pickingFrom: pickingFromAbility })
        return <p>Error: No ability with stats to pick from selected.</p>
    }

    const confirmSelection = () => {
        if (selection) applyPickedBonus(selection, pickingFromAbility)

        setPickingFromAbility(undefined)
    }

    return (
        <div className="flex min-h-[min(500px,calc(100dvh-12rem))] w-full flex-col items-center justify-center">
            <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2 sm:gap-4">
                {pickingFromAbility.pickFrom.domains.map((domain) => (
                    <Button variant={selection === domain ? "default" : "secondary"} onClick={() => setSelection(domain)} key={domain}>
                        {domain.toUpperCase()}
                    </Button>
                ))}
                {pickingFromAbility.pickFrom.skills.map((skill) => (
                    <Button variant={selection === skill ? "default" : "secondary"} onClick={() => setSelection(skill)} key={skill}>
                        {skill.toUpperCase()}
                    </Button>
                ))}
                {pickingFromAbility.pickFrom.protections.map((prot) => (
                    <Button variant={selection === prot ? "default" : "secondary"} onClick={() => setSelection(prot)} key={prot}>
                        +1 {prot.toUpperCase()}
                    </Button>
                ))}
            </div>

            <Button disabled={!selection} variant={"outline"} onClick={confirmSelection} className="mt-12">
                Confirm Selection
            </Button>
        </div>
    )
}

export default Abilities
