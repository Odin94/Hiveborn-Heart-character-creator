import { cn } from "@/lib/utils"
import { RollerTab } from "../types"

const rollerTabs: { value: RollerTab; label: string }[] = [
    { value: "skill-domain", label: "Skill/Domain" },
    { value: "free-roll", label: "Free Roll" },
]

const TabSwitcher = ({ activeTab, rolling, setActiveTab }: { activeTab: RollerTab; rolling: boolean; setActiveTab: (tab: RollerTab) => void }) => {
    return (
        <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-md border border-primary/25">
            {rollerTabs.map((tab) => (
                <button
                    key={tab.value}
                    type="button"
                    className={cn(
                        "h-10 border-r border-primary/20 text-sm font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60",
                        activeTab === tab.value ? "bg-primary text-primary-foreground" : "bg-background text-primary hover:bg-accent",
                    )}
                    disabled={rolling}
                    onClick={() => setActiveTab(tab.value)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    )
}

export default TabSwitcher
