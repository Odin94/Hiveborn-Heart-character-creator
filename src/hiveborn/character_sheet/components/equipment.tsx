import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { equipmentTags } from "@/hiveborn/game_data/equipment_tags"
import { BookOpen } from "lucide-react"
import { useCharacterStore } from "../character_states"
import { TagReferenceDialog } from "./shared/tag_reference_dialog"

const Equipment = () => {
    const equipment = useCharacterStore.use.equipment()
    const setEquipment = useCharacterStore.use.setEquipment()
    const abilities = useCharacterStore.use.abilities()

    return (
        <div>
            <div className="row-span-3 col-span-2 text-left mt-2">
                <Dialog>
                    <h2 className="relative font-bold py-2 bg-red-900 text-white pl-3">
                        EQUIPMENT
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1/2 right-3 h-8 w-8 -translate-y-1/2 text-white hover:bg-red-800 hover:text-white sm:right-7"
                                aria-label="Open equipment tag reference"
                                title="Open equipment tag reference"
                            >
                                <BookOpen className="h-5 w-5" />
                            </Button>
                        </DialogTrigger>
                    </h2>
                    <EquipmentTagsDialog equipment={equipment} abilities={abilities} />
                </Dialog>
                <MarkdownTextarea value={equipment} onChange={(e) => setEquipment(e.target.value)} className="h-30" />
            </div>
        </div>
    )
}

const EquipmentTagsDialog = ({ equipment, abilities }: { equipment: string; abilities: string }) => {
    return (
        <TagReferenceDialog
            title="EQUIPMENT TAGS"
            tags={equipmentTags}
            primaryText={equipment}
            primarySourceLabel="Equipment"
            secondaryText={abilities}
            secondarySourceLabel="Abilities"
        />
    )
}

export default Equipment
