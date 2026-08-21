import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { DomainKey } from "@/hiveborn/game_data/domains"
import { SkillKey } from "@/hiveborn/game_data/skills"
import { RollRisk } from "../../../dice_roller_state"
import { capitalize } from "../roll_utils"

const risks: { value: RollRisk; label: string }[] = [
    { value: "normal", label: "Normal" },
    { value: "risky", label: "Risky" },
    { value: "dangerous", label: "Dangerous" },
]

const SkillDomainControls = ({
    trainedSkills,
    trainedDomains,
    selectedSkill,
    selectedDomain,
    hasMastery,
    risk,
    rolling,
    setSelectedSkill,
    setSelectedDomain,
    setHasMastery,
    setRisk,
}: {
    trainedSkills: SkillKey[]
    trainedDomains: DomainKey[]
    selectedSkill: SkillKey | ""
    selectedDomain: DomainKey | ""
    hasMastery: boolean
    risk: RollRisk
    rolling: boolean
    setSelectedSkill: (skill: SkillKey | "") => void
    setSelectedDomain: (domain: DomainKey | "") => void
    setHasMastery: (hasMastery: boolean) => void
    setRisk: (risk: RollRisk) => void
}) => {
    return (
        <>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="grid gap-1 text-sm font-semibold">
                    Skill
                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                        value={selectedSkill}
                        disabled={rolling}
                        onChange={(event) => setSelectedSkill(event.target.value as typeof selectedSkill)}
                    >
                        <option value="">No relevant skill</option>
                        {trainedSkills.map((skill) => (
                            <option key={skill} value={skill}>
                                {capitalize(skill)}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="grid gap-1 text-sm font-semibold">
                    Domain
                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                        value={selectedDomain}
                        disabled={rolling}
                        onChange={(event) => setSelectedDomain(event.target.value as typeof selectedDomain)}
                    >
                        <option value="">No relevant domain</option>
                        {trainedDomains.map((domain) => (
                            <option key={domain} value={domain}>
                                {capitalize(domain)}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
                    <Checkbox checked={hasMastery} disabled={rolling} onCheckedChange={(checked) => setHasMastery(checked === true)} />
                    Mastery
                </label>
            </div>

            <div className="my-4 grid grid-cols-3 overflow-hidden rounded-md border border-primary/25">
                {risks.map((riskOption) => (
                    <button
                        key={riskOption.value}
                        type="button"
                        className={cn(
                            "h-10 border-r border-primary/20 text-sm font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60",
                            risk === riskOption.value ? "bg-primary text-primary-foreground" : "bg-background text-primary hover:bg-accent",
                        )}
                        disabled={rolling}
                        onClick={() => setRisk(riskOption.value)}
                    >
                        {riskOption.label}
                    </button>
                ))}
            </div>
        </>
    )
}

export default SkillDomainControls
