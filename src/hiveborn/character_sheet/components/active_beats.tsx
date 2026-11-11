import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Markdown } from "@/components/ui/markdown"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { beatTypes, beatsByCalling, type Beat, type BeatType } from "@/hiveborn/game_data/beats"
import { isCalling } from "@/hiveborn/game_data/callings"
import { formatBeatEntry, formatRulesText, normalizeMarkdownText } from "@/hiveborn/character_sheet/markdown_formatting"
import { useState } from "react"
import { useCharacterStore } from "../character_states"
import { DialogTriggerWrapper } from "./shared/DialogTriggerWrapper"
import { SheetSection } from "./shared/sheet_section"
import { PickerEmpty, PickerList } from "./shared/picker"

const ActiveBeats = ({ className }: { className?: string }) => {
    const activeBeats = useCharacterStore.use.activeBeats()
    const setActiveBeats = useCharacterStore.use.setActiveBeats()
    const calling = useCharacterStore.use.calling()
    const [pickerOpen, setPickerOpen] = useState(false)

    // TODOdin: Make beats line-by-line with a checkbox and store completed beats in a history somewhere
    // TODOdin: Add MAJOR/MINOR badge to beats
    return (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <SheetSection
                title="Active beats"
                className={`sheet-section-active-focus ${className ?? ""}`}
                action={<DialogTriggerWrapper label="Choose beats" />}
            >
                <MarkdownTextarea aria-label="Active beats" value={activeBeats} onChange={(e) => setActiveBeats(e.target.value)} className="h-28" />
            </SheetSection>
            {pickerOpen ? (
                <BeatsDialog
                    calling={calling}
                    onSelect={(beat) => {
                        const newBeat = formatBeatEntry(beat)
                        if (activeBeats.trim() === "") setActiveBeats(newBeat)
                        else setActiveBeats(`${activeBeats}\n\n${newBeat}`)

                        setPickerOpen(false)
                    }}
                />
            ) : null}
        </Dialog>
    )
}

const BeatsDialog = ({ calling, onSelect }: { calling: string; onSelect: (beat: Beat) => void }) => {
    const activeBeats = useCharacterStore.use.activeBeats()
    const [beatType, setBeatType] = useState<BeatType>("minor")
    const beatOptions = isCalling(calling) ? beatsByCalling[calling] : []
    const normalizedActiveBeats = normalizeMarkdownText(activeBeats)
    const isBeatPickedAlready = (beat: Beat) => {
        return (
            normalizedActiveBeats.includes(normalizeMarkdownText(formatBeatEntry(beat))) ||
            normalizedActiveBeats.includes(normalizeMarkdownText(beat.description))
        )
    }
    const filteredBeatOptions = beatOptions.filter((beat) => beat.type === beatType).filter((beat) => !isBeatPickedAlready(beat))

    const renderBeats = () => (
        <ScrollArea className="min-h-0 flex-1">
            {filteredBeatOptions.length === 0 ? (
                <PickerEmpty>No beats left in this section.</PickerEmpty>
            ) : (
                <PickerList>
                    {filteredBeatOptions.map((beat) => (
                        <button key={`${beat.type}-${beat.description}`} type="button" className="sheet-pick" onClick={() => onSelect(beat)}>
                            <Markdown className="text-sm leading-relaxed">{formatRulesText(beat.description)}</Markdown>
                        </button>
                    ))}
                </PickerList>
            )}
        </ScrollArea>
    )

    return (
        <DialogContent
            className={`flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:max-h-[calc(100dvh-2rem)] sm:w-[40rem] sm:max-w-[min(40rem,calc(100vw-2rem))] ${
                beatOptions.length === 0 ? "h-auto" : "h-[calc(100dvh-1rem)] sm:h-[min(46rem,calc(100dvh-2rem))]"
            }`}
        >
            <DialogHeader>
                <p className="eyebrow">Active beats</p>
                <DialogTitle>{isCalling(calling) ? `${calling} beats` : "Beats"}</DialogTitle>
                <DialogDescription className={beatOptions.length === 0 ? "" : "sr-only"}>
                    {beatOptions.length === 0 ? "Pick one of the callings from the rulebook to choose beats." : "Pick a beat to add it to your sheet."}
                </DialogDescription>
            </DialogHeader>
            {beatOptions.length > 0 ? (
                <Tabs value={beatType} onValueChange={(newBeatType) => setBeatType(newBeatType as BeatType)} className="min-h-0 flex-1">
                    <TabsList variant="segmented" className="shrink-0">
                        {beatTypes.map((type) => (
                            <TabsTrigger key={type} value={type}>
                                {capitalize(type)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {beatTypes.map((type) => (
                        <TabsContent key={type} value={type} className="flex flex-col">
                            {renderBeats()}
                        </TabsContent>
                    ))}
                </Tabs>
            ) : null}
        </DialogContent>
    )
}

const capitalize = (text: string) => `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`

export default ActiveBeats
