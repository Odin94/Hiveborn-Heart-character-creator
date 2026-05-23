import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { abilitiesByClassOrCalling, Ability, comesWithPick, PickFromOption } from "@/hiveborn/game_data/abilities"
import { CharacterClass } from "@/hiveborn/game_data/classes"
import { iconByDomain } from "@/hiveborn/game_data/domains"
import { iconBySkill } from "@/hiveborn/game_data/skills"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs"
import { Dispatch, SetStateAction, useState } from "react"
import { ChevronDown } from "lucide-react"
import { MdOutlineShield } from "react-icons/md"
import { useCharacterStore } from "../character_states"
import { useApplyPickedBonus } from "../hooks/useApplyPickedBonus"
import { useApplyStaticBonuses } from "../hooks/useApplyStaticBonuses"

type PickingFromState = [Ability | undefined, Dispatch<SetStateAction<Ability | undefined>>]

const Abilities = () => {
    const abilities = useCharacterStore.use.abilities()
    const setAbilities = useCharacterStore.use.setAbilities()
    const characterClass = useCharacterStore.use.characterClass()
    const [pickingFromAbility, setPickingFromAbility] = useState<Ability>()

    // TODOdin: Add https://milkdown.dev or https://lexical.dev instead of plain Textarea to render Markdown
    return (
        <div>
            <div className="row-span-3 col-span-2 text-left mt-2">
                <Dialog onOpenChange={(_open) => setPickingFromAbility(undefined)}>
                    <h2 className="font-bold py-2 bg-red-900 text-white pl-3">
                        ABILITIES{" "}
                        <DialogTrigger className="absolute right-7 hover:bg-red-800">
                            <ChevronDown className="inline w-4 h-4" />
                        </DialogTrigger>
                    </h2>
                    <AbilitiesDialog characterClass={characterClass} pickingFromState={[pickingFromAbility, setPickingFromAbility]} />
                </Dialog>

                <Textarea value={abilities} onChange={(e) => setAbilities(e.target.value)} className="h-142" />
            </div>
        </div>
    )
}

const putAfterParentAbility = (fullAbilityText: string, parentNameWithDash: string, newAbilityText: string): string => {
    const splitBySearchText = fullAbilityText.split(parentNameWithDash)
    const textBeforeParentName = splitBySearchText[0]
    if (splitBySearchText.length > 1) {
        const splitByNewline = splitBySearchText[1].split("\n\n")
        const parentDescription = splitByNewline[0]
        const textAfterParent = splitByNewline.slice(1).join("\n\n")

        return `${textBeforeParentName}${parentNameWithDash}${parentDescription} \n  - ${newAbilityText}\n\n${textAfterParent}`
    } else {
        return `${fullAbilityText}\n\n${newAbilityText}`
    }
}

const AbilitiesDialog = ({ characterClass, pickingFromState }: { characterClass: CharacterClass | string; pickingFromState: PickingFromState }) => {
    const [pickingFromAbility, setPickingFromAbility] = pickingFromState
    const [abilityType, setAbilityType] = useState("minor")
    const abilities = useCharacterStore.use.abilities()
    const setAbilities = useCharacterStore.use.setAbilities()
    const applyStaticBonuses = useApplyStaticBonuses()

    const isAbilityPickedAlready = (ability: Ability) => abilities.includes(`${ability.name} - `)
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
        <ScrollArea className="h-170" style={{ borderColor: "red" }}>
            {filteredAbilityOptions.map((ability) => {
                const isAlreadyPickedMajor = ability.type === "major" && abilities.includes(`${ability.name} - `)
                return (
                    <div
                        key={ability.name}
                        className={`border-1 p-2 border-t-0 
                            ${ability.parentName ? "ml-6" : ""} 
                            ${isAlreadyPickedMajor ? "border border-[#999999] bg-[#eee] text-[#888] hover:bg-[#eee]" : "cursor-pointer hover:bg-accent"}
                        `}
                        onClick={() => {
                            if (isAlreadyPickedMajor) return

                            if (ability.parentName) {
                                setAbilities(putAfterParentAbility(abilities, `${ability.parentName} - `, `${ability.name} - ${ability.description}`))
                            } else {
                                if (abilities.trim() === "") return setAbilities(`${ability.name} - ${ability.description}`)
                                else setAbilities(`${abilities}\n\n${ability.name} - ${ability.description}`)
                            }
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

                        <p className="text-muted-foreground text-sm">{ability.description}</p>
                    </div>
                )
            })}
        </ScrollArea>
    )

    return (
        <DialogContent className="w-88 sm:w-112 h-200">
            <DialogHeader>
                <DialogTitle>{pickingFromAbility ? pickingFromAbility.name.toUpperCase() : `${characterClass.toUpperCase()} ABILITIES`}</DialogTitle>
                <DialogDescription></DialogDescription>
                {abilityOptions.length === 0 ? (
                    <p>Pick a pre-defined class to select abilities</p>
                ) : pickingFromAbility ? (
                    <PickFrom pickingFromState={[pickingFromAbility, setPickingFromAbility]} />
                ) : (
                    <Tabs defaultValue="minor" className="w-[300px] sm:w-[400px] p-2" value={abilityType} onValueChange={setAbilityType}>
                        <TabsList className="grid w-full grid-cols-3">
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

                        <TabsContent value="minor">{renderAbilities()}</TabsContent>
                        <TabsContent value="major">{renderAbilities()}</TabsContent>
                        <TabsContent value="zenith">{renderAbilities()}</TabsContent>
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
        <div className="flex flex-col w-full h-[500px] justify-center items-center">
            <div className="grid grid-cols-2 gap-4">
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
