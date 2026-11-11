import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dices, Hexagon } from "lucide-react"
import { RollerTab } from "../types"

const rollerTabs: { value: RollerTab; label: string; icon: typeof Dices }[] = [
    { value: "skill-domain", label: "Skill/Domain", icon: Hexagon },
    { value: "free-roll", label: "Free Roll", icon: Dices },
]

/** Segmented switch between the Heart roll and a free roll. Render inside a <Tabs> root. */
const TabSwitcher = ({ rolling }: { rolling: boolean }) => {
    return (
        <TabsList aria-label="Roll type">
            {rollerTabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} disabled={rolling}>
                    <Icon aria-hidden="true" />
                    {label}
                </TabsTrigger>
            ))}
        </TabsList>
    )
}

export default TabSwitcher
