import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Markdown } from "@/components/ui/markdown"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatFalloutEntry, formatRulesText, hasTitledEntry } from "@/hiveborn/character_sheet/markdown_formatting"
import { falloutOptions, falloutSeverities, type Fallout as FalloutOption, type FalloutSeverity } from "@/hiveborn/game_data/fallout"
import { resistances, type Resistance } from "@/hiveborn/game_data/resistances"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useCharacterStore } from "../character_states"
import { DialogTriggerWrapper } from "./shared/DialogTriggerWrapper"
import { SheetSection } from "./shared/sheet_section"

const Fallout = ({ className }: { className?: string }) => {
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
        <>
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <SheetSection title="Fallout" className={className} action={<DialogTriggerWrapper label="Choose fallout" />}>
                    <MarkdownTextarea aria-label="Fallout" value={fallout} onChange={(e) => setFallout(e.target.value)} className="h-70" />
                </SheetSection>
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
        </>
    )
}

const FalloutDialog = ({ onSelect }: { onSelect: (fallout: FalloutOption) => void }) => {
    const fallout = useCharacterStore.use.fallout()
    const [falloutSeverity, setFalloutSeverity] = useState<FalloutSeverity>("minor")
    const [resistance, setResistance] = useState<Resistance>("blood")
    const isFalloutPickedAlready = (falloutOption: FalloutOption) =>
        hasTitledEntry(fallout, falloutOption.name) ||
        hasTitledEntry(fallout, `${falloutOption.name} (${falloutOption.severity})`) ||
        hasTitledEntry(fallout, `${falloutOption.name} (${falloutOption.severity}, ${falloutOption.resistance})`)
    const availableForSeverity = falloutOptions
        .filter((falloutOption) => falloutOption.severity === falloutSeverity)
        .filter((falloutOption) => !isFalloutPickedAlready(falloutOption))
    const filteredFalloutOptions = availableForSeverity.filter((falloutOption) => falloutOption.resistance === resistance)

    return (
        <DialogContent className="flex h-[min(46rem,calc(100dvh-1.5rem-var(--safe-bottom)))] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl sm:p-0 [&_[data-slot=dialog-close-button]]:top-3 [&_[data-slot=dialog-close-button]]:right-3">
            <DialogHeader className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
                <DialogTitle>Fallout</DialogTitle>
                <DialogDescription>Choose fallout to add to this sheet.</DialogDescription>
            </DialogHeader>

            <Tabs
                value={falloutSeverity}
                onValueChange={(newSeverity) => setFalloutSeverity(newSeverity as FalloutSeverity)}
                className="flex min-h-0 flex-1 flex-col gap-0"
            >
                <div className="px-5 pb-1 sm:px-6">
                    <TabsList aria-label="Severity" className="grid grid-cols-3">
                        {falloutSeverities.map((severity) => (
                            <TabsTrigger key={severity} value={severity}>
                                {capitalize(severity)}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value={falloutSeverity} className="flex min-h-0 flex-1 flex-col">
                    <Tabs
                        value={resistance}
                        onValueChange={(newResistance) => setResistance(newResistance as Resistance)}
                        className="flex min-h-0 flex-1 flex-col gap-0"
                    >
                        <TabsList variant="underline" aria-label="Resistance" className="shrink-0 px-2 sm:px-4">
                            {resistances.map((resistanceOption) => {
                                const available = availableForSeverity.filter((falloutOption) => falloutOption.resistance === resistanceOption).length
                                return (
                                    <TabsTrigger key={resistanceOption} value={resistanceOption} className="gap-1.5 px-2 sm:px-3">
                                        {capitalize(resistanceOption)}
                                        <span className="hidden text-xs font-semibold text-muted-foreground tabular-nums sm:inline">{available}</span>
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>

                        <TabsContent value={resistance} className="min-h-0 flex-1 bg-sunken/60">
                            <ScrollArea className="h-full">
                                {filteredFalloutOptions.length === 0 ? (
                                    <p className="px-6 py-10 text-center text-sm text-muted-foreground">No available fallout in this section.</p>
                                ) : (
                                    <ul className="grid gap-2 p-3 pb-[max(0.75rem,var(--safe-bottom))] sm:p-4">
                                        {filteredFalloutOptions.map((falloutOption) => (
                                            <li key={`${falloutOption.severity}-${falloutOption.resistance}-${falloutOption.name}`}>
                                                <button
                                                    type="button"
                                                    className="sheet-pick fallout-option group/option grid! grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1"
                                                    onClick={() => onSelect(falloutOption)}
                                                >
                                                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                                                        <span className="font-display text-lg leading-tight font-bold">{falloutOption.name}</span>
                                                        <span className="text-[0.6875rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                                                            {falloutOption.effects.join(" · ")}
                                                        </span>
                                                    </span>
                                                    <span
                                                        className="row-span-2 grid size-8 place-items-center self-center rounded-md text-muted-foreground transition-colors duration-150 ease-out group-hover/option:bg-primary group-hover/option:text-primary-foreground"
                                                        aria-hidden="true"
                                                    >
                                                        <Plus className="size-4" />
                                                    </span>
                                                    <Markdown className="text-sm text-muted-foreground">{formatRulesText(falloutOption.description)}</Markdown>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
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
        <ConfirmDialog
            open={!!pendingStressClear}
            onOpenChange={(open) => !open && onCancel()}
            title={`Clear ${isMajor ? "all" : resistanceLabel} stress for '${pendingStressClear?.name ?? ""}'?`}
            description={isMajor ? "Major fallout clears stress from every resistance." : `Minor fallout clears stress from ${resistanceLabel}.`}
            cancelLabel="Keep Stress"
            confirmLabel="Clear Stress"
            destructive={false}
            onConfirm={onConfirm}
        />
    )
}

const capitalize = (text: string) => `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`

export default Fallout
