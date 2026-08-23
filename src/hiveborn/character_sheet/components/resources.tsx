import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { resourceTags } from "@/hiveborn/game_data/resource_tags"
import { BookOpen } from "lucide-react"
import { useCharacterStore } from "../character_states"
import { TagReferenceDialog } from "./shared/tag_reference_dialog"

const Resources = () => {
    const resources = useCharacterStore.use.resources()
    const setResources = useCharacterStore.use.setResources()
    const abilities = useCharacterStore.use.abilities()

    return (
        <div>
            <div className="row-span-3 col-span-2 text-left mt-2">
                <Dialog>
                    <h2 className="relative font-bold py-2 bg-red-900 text-white pl-3">
                        RESOURCES
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1/2 right-3 h-8 w-8 -translate-y-1/2 text-white hover:bg-red-800 hover:text-white sm:right-7"
                                aria-label="Open resource tag reference"
                                title="Open resource tag reference"
                            >
                                <BookOpen className="h-5 w-5" />
                            </Button>
                        </DialogTrigger>
                    </h2>
                    <TagReferenceDialog
                        title="RESOURCE TAGS"
                        tags={resourceTags}
                        primaryText={resources}
                        primarySourceLabel="Resources"
                        secondaryText={abilities}
                        secondarySourceLabel="Abilities"
                    />
                </Dialog>
                <MarkdownTextarea value={resources} onChange={(e) => setResources(e.target.value)} className="h-30" />
            </div>
        </div>
    )
}

export default Resources
