import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { Hint } from "@/components/ui/tooltip"
import { resourceTags } from "@/hiveborn/game_data/resource_tags"
import { BookOpen } from "lucide-react"
import { useCharacterStore } from "../character_states"
import { SectionAction, SheetSection } from "./shared/sheet_section"
import { TagReferenceDialog } from "./shared/tag_reference_dialog"

const Resources = ({ className }: { className?: string }) => {
    const resources = useCharacterStore.use.resources()
    const setResources = useCharacterStore.use.setResources()
    const abilities = useCharacterStore.use.abilities()

    return (
        <Dialog>
            <SheetSection
                title="Resources"
                className={className}
                action={
                    <SectionAction>
                        <Hint label="Resource tags">
                            <DialogTrigger className="sheet-band-action" aria-label="Open resource tag reference">
                                <BookOpen className="size-[1.125rem]" />
                            </DialogTrigger>
                        </Hint>
                    </SectionAction>
                }
            >
                <MarkdownTextarea aria-label="Resources" value={resources} onChange={(e) => setResources(e.target.value)} className="h-36" />
            </SheetSection>
            <TagReferenceDialog
                title="RESOURCE TAGS"
                tags={resourceTags}
                primaryText={resources}
                primarySourceLabel="Resources"
                secondaryText={abilities}
                secondarySourceLabel="Abilities"
            />
        </Dialog>
    )
}

export default Resources
