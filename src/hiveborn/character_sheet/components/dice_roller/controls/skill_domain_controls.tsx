import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DomainKey } from "@/hiveborn/game_data/domains"
import { SkillKey } from "@/hiveborn/game_data/skills"
import { RollRisk } from "../../../dice_roller_state"
import { capitalize } from "../roll_utils"

const risks: { value: RollRisk; label: string; effect: string }[] = [
    { value: "normal", label: "Normal", effect: "Keep every die." },
    { value: "risky", label: "Risky", effect: "Your highest die is discarded." },
    { value: "dangerous", label: "Dangerous", effect: "Your two highest dice are discarded." },
]

// Radix Select forbids "" as an item value; map "no choice" to a sentinel.
const NONE = "none"

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
    const activeRisk = risks.find((option) => option.value === risk) ?? risks[0]

    return (
        <div className="grid gap-4">
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="grid min-w-0 gap-1.5">
                    <Label id="dice-roller-skill-label">Skill</Label>
                    <Select
                        value={selectedSkill || NONE}
                        disabled={rolling}
                        onValueChange={(value) => setSelectedSkill(value === NONE ? "" : (value as SkillKey))}
                    >
                        <SelectTrigger aria-labelledby="dice-roller-skill-label">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>No relevant skill</SelectItem>
                            {trainedSkills.map((skill) => (
                                <SelectItem key={skill} value={skill}>
                                    {capitalize(skill)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid min-w-0 gap-1.5">
                    <Label id="dice-roller-domain-label">Domain</Label>
                    <Select
                        value={selectedDomain || NONE}
                        disabled={rolling}
                        onValueChange={(value) => setSelectedDomain(value === NONE ? "" : (value as DomainKey))}
                    >
                        <SelectTrigger aria-labelledby="dice-roller-domain-label">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>No relevant domain</SelectItem>
                            {trainedDomains.map((domain) => (
                                <SelectItem key={domain} value={domain}>
                                    {capitalize(domain)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <label
                    className={cn(
                        "col-span-2 flex h-10 items-center gap-2.5 rounded-md sm:col-span-1 border border-input bg-sunken px-3 text-sm font-semibold shadow-xs",
                        "transition-[background-color,border-color] duration-150 ease-out",
                        "has-data-[state=checked]:border-primary/55 has-data-[state=checked]:bg-primary/8",
                        rolling ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-border-strong",
                    )}
                >
                    <Checkbox checked={hasMastery} disabled={rolling} onCheckedChange={(checked) => setHasMastery(checked === true)} />
                    Mastery
                </label>
            </div>

            <div className="grid gap-1.5">
                <span className="text-sm leading-none font-semibold" id="dice-roller-risk-label">
                    Risk
                </span>
                <div className="segmented-control grid grid-cols-3 rounded-lg border" role="group" aria-labelledby="dice-roller-risk-label">
                    {risks.map((riskOption) => (
                        <button
                            key={riskOption.value}
                            type="button"
                            className="dice-risk-option px-2 disabled:opacity-60"
                            data-risk={riskOption.value}
                            data-state={risk === riskOption.value ? "active" : "inactive"}
                            disabled={rolling}
                            aria-pressed={risk === riskOption.value}
                            onClick={() => setRisk(riskOption.value)}
                        >
                            {riskOption.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    {activeRisk.effect}
                </p>
            </div>
        </div>
    )
}

export default SkillDomainControls
