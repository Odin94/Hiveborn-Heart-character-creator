import CharacterSheet from "@/hiveborn/character_sheet/character_sheet"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import {
    JSONDownloadButton,
    JSONUploadButton,
    PDFDownloadButton,
    ResetButton,
    DeletedCharactersButton,
} from "@/hiveborn/character_sheet/components/character_buttons"
import { DiceRollerDockButton } from "@/hiveborn/character_sheet/components/character_tabs"
import CookieConsent from "@/components/cookie-consent"
import DiceRoller from "@/hiveborn/character_sheet/components/dice_roller/dice_roller"
import { Button } from "@/components/ui/button"
import { Hint } from "@/components/ui/tooltip"
import { Undo2 } from "lucide-react"
import { toast } from "sonner"

export function CharacterSheetPage() {
    const undoCharacterChange = useCharacterStore.use.undoCharacterChange()
    const canUndo = useCharacterStore((state) => state.characterHistory.length > 0)

    return (
        <div className="relative min-h-(--page-min-h) pb-28">
            <CookieConsent variant="small" />
            <div className="page-container max-w-[84rem] pt-5 text-foreground sm:pt-8">
                <CharacterSheet />

                {/* Sheet ledger: export, import and recovery */}
                <div className="sheet-ledger mt-4 sm:mt-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <PDFDownloadButton />
                        <JSONDownloadButton />
                        <JSONUploadButton />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                        <Hint label="Nothing to undo yet" wrap disabled={canUndo}>
                            <Button
                                variant="ghost"
                                disabled={!canUndo}
                                onClick={() => {
                                    undoCharacterChange()
                                    toast.success("Restored the previous sheet change")
                                }}
                            >
                                <Undo2 /> Undo recent change
                            </Button>
                        </Hint>
                        <DeletedCharactersButton />
                        <ResetButton />
                    </div>

                    {/* TODOdin: Add a button that opens a history pane that keeps character-states from the past (in case you accidentally overwrite) */}
                </div>
            </div>
            <DiceRoller />
            <DiceRollerDockButton />
        </div>
    )
}
