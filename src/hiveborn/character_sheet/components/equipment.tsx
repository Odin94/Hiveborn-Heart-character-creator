import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { Hint } from "@/components/ui/tooltip"
import { equipmentTags } from "@/hiveborn/game_data/equipment_tags"
import { BookOpen } from "lucide-react"
import { useCharacterStore } from "../character_states"
import { SectionAction, SheetSection } from "./shared/sheet_section"
import { TagReferenceDialog } from "./shared/tag_reference_dialog"

const Equipment = ({ className }: { className?: string }) => {
    const equipment = useCharacterStore.use.equipment()
    const setEquipment = useCharacterStore.use.setEquipment()
    const abilities = useCharacterStore.use.abilities()

    return (
        <Dialog>
            <SheetSection
                title="Equipment"
                className={className}
                action={
                    <SectionAction>
                        <Hint label="Equipment tags">
                            <DialogTrigger className="sheet-band-action" aria-label="Open equipment tag reference">
                                <BookOpen className="size-[1.125rem]" />
                            </DialogTrigger>
                        </Hint>
                    </SectionAction>
                }
            >
                <MarkdownTextarea aria-label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} className="h-36" />
            </SheetSection>
            <TagReferenceDialog
                title="EQUIPMENT TAGS"
                tags={equipmentTags}
                primaryText={equipment}
                primarySourceLabel="Equipment"
                secondaryText={abilities}
                secondarySourceLabel="Abilities"
            />
        </Dialog>
    )
}

export default Equipment
