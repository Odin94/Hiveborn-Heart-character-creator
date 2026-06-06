import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { useCharacterStore } from "../character_states"

const Resources = () => {
    const resources = useCharacterStore.use.resources()
    const setResources = useCharacterStore.use.setResources()

    return (
        <div>
            <div className="row-span-3 col-span-2 text-left mt-2">
                <h2 className="font-bold py-2 bg-red-900 text-white pl-3">RESOURCES</h2>
                <MarkdownTextarea value={resources} onChange={(e) => setResources(e.target.value)} className="h-30" />
            </div>
        </div>
    )
}

export default Resources
