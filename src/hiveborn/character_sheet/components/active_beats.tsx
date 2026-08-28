import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Markdown } from "@/components/ui/markdown"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { beatTypes, beatsByCalling, type Beat, type BeatType } from "@/hiveborn/game_data/beats"
import { isCalling } from "@/hiveborn/game_data/callings"
import { formatBeatEntry, formatRulesText, normalizeMarkdownText } from "@/hiveborn/character_sheet/markdown_formatting"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs"
import { useState } from "react"
import { useCharacterStore } from "../character_states"
import { DialogTriggerWrapper } from "./shared/DialogTriggerWrapper"

const ActiveBeats = () => {
    const activeBeats = useCharacterStore.use.activeBeats()
    const setActiveBeats = useCharacterStore.use.setActiveBeats()
    const calling = useCharacterStore.use.calling()
    const [pickerOpen, setPickerOpen] = useState(false)

    // TODOdin: Make beats line-by-line with a checkbox and store completed beats in a history somewhere
    // TODOdin: Add MAJOR/MINOR badge to beats
    return (
        <div className="row-span-3 col-span-2 text-left mt-5">
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <h2 className="relative font-bold py-2 bg-red-900 text-white pl-3">
                    ACTIVE BEATS <DialogTriggerWrapper />
                </h2>
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

            <MarkdownTextarea value={activeBeats} onChange={(e) => setActiveBeats(e.target.value)} className="h-25" />
        </div>
    )
}

const BeatsDialog = ({ calling, onSelect }: { calling: string; onSelect: (beat: Beat) => void }) => {
    const activeBeats = useCharacterStore.use.activeBeats()
    const [beatType, setBeatType] = useState<BeatType>("minor")
    const selectedBeatTypeClassName = "border-b-0"
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
        <ScrollArea className="min-h-0 flex-1" style={{ borderColor: "red" }}>
            {filteredBeatOptions.length === 0 ? (
                <p className="p-4 text-muted-foreground text-sm">No available beats in this section.</p>
            ) : (
                filteredBeatOptions.map((beat) => (
                    <button
                        key={`${beat.type}-${beat.description}`}
                        type="button"
                        className="border-1 border-t-0 px-4 py-3 text-left w-full cursor-pointer hover:bg-accent"
                        onClick={() => onSelect(beat)}
                    >
                        <Markdown className="text-sm">{formatRulesText(beat.description)}</Markdown>
                    </button>
                ))
            )}
        </ScrollArea>
    )

    return (
        <DialogContent
            className={`flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:max-h-[calc(100vh-2rem)] sm:w-[44rem] sm:max-w-[44rem] ${
                beatOptions.length === 0 ? "h-auto" : "h-[calc(100dvh-1rem)] sm:h-[min(50rem,calc(100dvh-2rem))]"
            }`}
        >
            <DialogHeader className="min-h-0 flex-1 overflow-hidden">
                <DialogTitle>{isCalling(calling) ? `${calling.toUpperCase()} BEATS` : "ACTIVE BEATS"}</DialogTitle>
                <DialogDescription></DialogDescription>
                {beatOptions.length === 0 ? (
                    <p>Pick a pre-defined calling to select beats</p>
                ) : (
                    <Tabs
                        defaultValue="minor"
                        className="flex min-h-0 w-full flex-1 flex-col p-1 sm:p-2"
                        value={beatType}
                        onValueChange={(newBeatType) => setBeatType(newBeatType as BeatType)}
                    >
                        <TabsList className="grid w-full shrink-0 grid-cols-3">
                            {beatTypes.map((type) => (
                                <TabsTrigger key={type} value={type} className={`border-1 ${beatType === type ? selectedBeatTypeClassName : ""}`}>
                                    {capitalize(type)}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {beatTypes.map((type) => (
                            <TabsContent key={type} value={type} className="flex min-h-0 flex-1 flex-col">
                                {renderBeats()}
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </DialogHeader>
        </DialogContent>
    )
}

const capitalize = (text: string) => `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`

export default ActiveBeats
