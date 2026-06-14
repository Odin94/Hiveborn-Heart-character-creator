import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Markdown } from "@/components/ui/markdown"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatFalloutEntry, formatRulesText, hasTitledEntry } from "@/hiveborn/character_sheet/markdown_formatting"
import { falloutOptions, falloutSeverities, type Fallout as FalloutOption, type FalloutSeverity } from "@/hiveborn/game_data/fallout"
import { resistances, type Resistance } from "@/hiveborn/game_data/resistances"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs"
import { useState } from "react"
import { useCharacterStore } from "../character_states"
import { DialogTriggerWrapper } from "./shared/DialogTriggerWrapper"

const Fallout = () => {
    const fallout = useCharacterStore.use.fallout()
    const setFallout = useCharacterStore.use.setFallout()
    const stress = useCharacterStore.use.stress()
    const setStress = useCharacterStore.use.setStress()
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pendingStressClear, setPendingStressClear] = useState<FalloutOption>()

    const hasStressToClear = (selectedFallout: FalloutOption) => {
        if (selectedFallout.severity === "minor") return stress[selectedFallout.resistance] > 0
        if (selectedFallout.severity === "major") return Object.values(stress).some((stressValue) => stressValue > 0)
        return false
    }

    const clearStressForFallout = (selectedFallout: FalloutOption) => {
        if (selectedFallout.severity === "minor") {
            setStress({ ...stress, [selectedFallout.resistance]: 0 })
            return
        }

        if (selectedFallout.severity === "major") {
            setStress({
                blood: 0,
                mind: 0,
                echo: 0,
                fortune: 0,
                supplies: 0,
            })
        }
    }

    return (
        <div>
            <div className="row-span-3 col-span-2 text-left mt-2">
                <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                    <h2 className="relative font-bold py-2 bg-red-900 text-white pl-3">
                        FALLOUT <DialogTriggerWrapper />
                    </h2>
                    {pickerOpen ? (
                        <FalloutDialog
                            onSelect={(selectedFallout) => {
                                const newFallout = formatFalloutEntry(selectedFallout)
                                if (fallout.trim() === "") setFallout(newFallout)
                                else setFallout(`${fallout}\n\n${newFallout}`)

                                setPickerOpen(false)
                                if (hasStressToClear(selectedFallout)) setPendingStressClear(selectedFallout)
                            }}
                        />
                    ) : null}
                </Dialog>

                <ClearStressDialog
                    pendingStressClear={pendingStressClear}
                    onCancel={() => setPendingStressClear(undefined)}
                    onConfirm={() => {
                        if (pendingStressClear) clearStressForFallout(pendingStressClear)
                        setPendingStressClear(undefined)
                    }}
                />

                <MarkdownTextarea value={fallout} onChange={(e) => setFallout(e.target.value)} className="h-70" />
            </div>
        </div>
    )
}

const FalloutDialog = ({ onSelect }: { onSelect: (fallout: FalloutOption) => void }) => {
    const fallout = useCharacterStore.use.fallout()
    const [falloutSeverity, setFalloutSeverity] = useState<FalloutSeverity>("minor")
    const [resistance, setResistance] = useState<Resistance>("blood")
    const selectedSeverityClassName = "border-b-0"
    const selectedResistanceClassName = "border-y-0"
    const isFalloutPickedAlready = (falloutOption: FalloutOption) => hasTitledEntry(fallout, falloutOption.name)
    const filteredFalloutOptions = falloutOptions
        .filter((falloutOption) => falloutOption.severity === falloutSeverity)
        .filter((falloutOption) => falloutOption.resistance === resistance)
        .filter((falloutOption) => !isFalloutPickedAlready(falloutOption))

    const renderFalloutOptions = () => (
        <ScrollArea className="min-h-0 flex-1" style={{ borderColor: "red" }}>
            {filteredFalloutOptions.length === 0 ? (
                <p className="p-4 text-muted-foreground text-sm">No available fallout in this section.</p>
            ) : (
                filteredFalloutOptions.map((falloutOption) => (
                    <button
                        key={`${falloutOption.severity}-${falloutOption.resistance}-${falloutOption.name}`}
                        type="button"
                        className="border border-t-0 p-2 text-left w-full cursor-pointer hover:bg-accent"
                        onClick={() => onSelect(falloutOption)}
                    >
                        <h2 className="flex items-center justify-between gap-3">
                            <span>{falloutOption.name}</span>
                            <span className="text-xs text-muted-foreground">{falloutOption.effects.join(", ")}</span>
                        </h2>
                        <Markdown className="text-muted-foreground text-sm">{formatRulesText(falloutOption.description)}</Markdown>
                    </button>
                ))
            )}
        </ScrollArea>
    )

    return (
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:h-[min(50rem,calc(100dvh-2rem))] sm:max-h-[calc(100vh-2rem)] sm:w-176 sm:max-w-176">
            <DialogHeader className="min-h-0 flex-1 overflow-hidden">
                <DialogTitle>FALLOUT</DialogTitle>
                <DialogDescription></DialogDescription>
                <Tabs
                    defaultValue="minor"
                    className="flex min-h-0 w-full flex-1 flex-col p-1 sm:p-2"
                    value={falloutSeverity}
                    onValueChange={(newSeverity) => setFalloutSeverity(newSeverity as FalloutSeverity)}
                >
                    <TabsList className="grid w-full shrink-0 grid-cols-3">
                        {falloutSeverities.map((severity) => (
                            <TabsTrigger key={severity} value={severity} className={`border ${falloutSeverity === severity ? selectedSeverityClassName : ""}`}>
                                {capitalize(severity)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {falloutSeverities.map((severity) => (
                        <TabsContent key={severity} value={severity} className="flex min-h-0 flex-1 flex-col">
                            <Tabs
                                value={resistance}
                                onValueChange={(newResistance) => setResistance(newResistance as Resistance)}
                                className="flex h-full min-h-0 flex-col"
                            >
                                <TabsList className="mt-2 grid w-full shrink-0 grid-cols-2 sm:grid-cols-5">
                                    {resistances.map((resistanceOption) => (
                                        <TabsTrigger
                                            key={resistanceOption}
                                            value={resistanceOption}
                                            className={`border text-xs sm:text-sm ${resistance === resistanceOption ? selectedResistanceClassName : ""}`}
                                        >
                                            {capitalize(resistanceOption)}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>

                                {resistances.map((resistanceOption) => (
                                    <TabsContent key={resistanceOption} value={resistanceOption} className="flex min-h-0 flex-1 flex-col">
                                        {renderFalloutOptions()}
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </TabsContent>
                    ))}
                </Tabs>
            </DialogHeader>
        </DialogContent>
    )
}

const ClearStressDialog = ({
    pendingStressClear,
    onCancel,
    onConfirm,
}: {
    pendingStressClear: FalloutOption | undefined
    onCancel: () => void
    onConfirm: () => void
}) => {
    const isMajor = pendingStressClear?.severity === "major"
    const resistanceLabel = pendingStressClear ? capitalize(pendingStressClear.resistance) : ""

    return (
        <Dialog open={!!pendingStressClear} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Clear {isMajor ? "all" : resistanceLabel} stress for '{pendingStressClear?.name}'?
                    </DialogTitle>
                    <DialogDescription></DialogDescription>
                    <p className="text-muted-foreground text-md my-2">
                        {isMajor ? "Major fallout clears stress from every resistance." : `Minor fallout clears stress from ${resistanceLabel}.`}
                    </p>
                    <div className="mt-2 flex justify-end">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" onClick={onCancel}>
                                Keep Stress
                            </Button>
                        </DialogClose>
                        <DialogClose asChild>
                            <Button className="ml-3" type="button" onClick={onConfirm}>
                                Clear Stress
                            </Button>
                        </DialogClose>
                    </div>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

const capitalize = (text: string) => `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`

export default Fallout
