import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { useCharacterStore } from "../character_states"

const Equipment = () => {
    const equipment = useCharacterStore.use.equipment()
    const setEquipment = useCharacterStore.use.setEquipment()
    return (
        <div>
            <div className="row-span-3 col-span-2 text-left mt-2">
                <h2 className="font-bold py-2 bg-red-900 text-white pl-3">EQUIPMENT</h2>
                <MarkdownTextarea value={equipment} onChange={(e) => setEquipment(e.target.value)} className="h-30" />
            </div>
        </div>
    )
}

export default Equipment
