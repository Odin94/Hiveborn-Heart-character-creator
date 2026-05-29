import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { falloutSeverities, falloutOptions, type Fallout as FalloutOption, type FalloutSeverity } from "@/hiveborn/game_data/fallout"
import { resistances, type Resistance } from "@/hiveborn/game_data/resistances"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { useCharacterStore } from "../character_states"

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
                        FALLOUT{" "}
                        <DialogTrigger className="absolute top-1/2 right-3 -translate-y-1/2 hover:bg-red-800 sm:right-7">
                            <ChevronDown className="inline w-4 h-4" />
                        </DialogTrigger>
                    </h2>
                    {pickerOpen ? (
                        <FalloutDialog
                            onSelect={(selectedFallout) => {
                                const newFallout = `${selectedFallout.name} - ${selectedFallout.description}`
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

                <Textarea value={fallout} onChange={(e) => setFallout(e.target.value)} className="h-70" />
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
    const isFalloutPickedAlready = (falloutOption: FalloutOption) => fallout.toLowerCase().includes(`${falloutOption.name.toLowerCase()} - `)
    const filteredFalloutOptions = falloutOptions
        .filter((falloutOption) => falloutOption.severity === falloutSeverity)
        .filter((falloutOption) => falloutOption.resistance === resistance)
        .filter((falloutOption) => !isFalloutPickedAlready(falloutOption))

    const renderFalloutOptions = () => (
        <ScrollArea className="h-[calc(100dvh-17rem)] sm:h-150" style={{ borderColor: "red" }}>
            {filteredFalloutOptions.length === 0 ? (
                <p className="p-4 text-muted-foreground text-sm">No available fallout in this section.</p>
            ) : (
                filteredFalloutOptions.map((falloutOption) => (
                    <button
                        key={`${falloutOption.severity}-${falloutOption.resistance}-${falloutOption.name}`}
                        type="button"
                        className="border-1 border-t-0 p-2 text-left w-full cursor-pointer hover:bg-accent"
                        onClick={() => onSelect(falloutOption)}
                    >
                        <h2 className="flex items-center justify-between gap-3">
                            <span>{falloutOption.name}</span>
                            <span className="text-xs text-muted-foreground">{falloutOption.effects.join(", ")}</span>
                        </h2>
                        <p className="text-muted-foreground text-sm">{falloutOption.description}</p>
                    </button>
                ))
            )}
        </ScrollArea>
    )

    return (
        <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-sm:overflow-hidden sm:h-200 sm:w-[44rem] sm:max-w-[44rem]">
            <DialogHeader className="min-h-0">
                <DialogTitle>FALLOUT</DialogTitle>
                <DialogDescription></DialogDescription>
                <Tabs
                    defaultValue="minor"
                    className="w-full p-1 sm:p-2"
                    value={falloutSeverity}
                    onValueChange={(newSeverity) => setFalloutSeverity(newSeverity as FalloutSeverity)}
                >
                    <TabsList className="grid w-full grid-cols-3">
                        {falloutSeverities.map((severity) => (
                            <TabsTrigger
                                key={severity}
                                value={severity}
                                className={`border-1 ${falloutSeverity === severity ? selectedSeverityClassName : ""}`}
                            >
                                {capitalize(severity)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {falloutSeverities.map((severity) => (
                        <TabsContent key={severity} value={severity}>
                            <Tabs value={resistance} onValueChange={(newResistance) => setResistance(newResistance as Resistance)}>
                                <TabsList className="grid w-full grid-cols-2 mt-2 sm:grid-cols-5">
                                    {resistances.map((resistanceOption) => (
                                        <TabsTrigger
                                            key={resistanceOption}
                                            value={resistanceOption}
                                            className={`border-1 text-xs sm:text-sm ${resistance === resistanceOption ? selectedResistanceClassName : ""}`}
                                        >
                                            {capitalize(resistanceOption)}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>

                                {resistances.map((resistanceOption) => (
                                    <TabsContent key={resistanceOption} value={resistanceOption}>
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
