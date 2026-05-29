import { DomainKey } from "@/hiveborn/game_data/domains"
import { SkillKey } from "@/hiveborn/game_data/skills"
import { createSelectors } from "@/lib/selectors"
import { create } from "zustand"

export type RollRisk = "normal" | "risky" | "dangerous"

type DiceRollerState = {
    isOpen: boolean
    selectedSkill: SkillKey | ""
    selectedDomain: DomainKey | ""
    hasMastery: boolean
    risk: RollRisk
    setOpen: (isOpen: boolean) => void
    setSelectedSkill: (selectedSkill: SkillKey | "") => void
    setSelectedDomain: (selectedDomain: DomainKey | "") => void
    setHasMastery: (hasMastery: boolean) => void
    setRisk: (risk: RollRisk) => void
    pickSkill: (selectedSkill: SkillKey) => void
    pickDomain: (selectedDomain: DomainKey) => void
}

export const useDiceRollerStore = createSelectors(
    create<DiceRollerState>()((set) => ({
        isOpen: false,
        selectedSkill: "",
        selectedDomain: "",
        hasMastery: false,
        risk: "normal",
        setOpen: (isOpen) => set({ isOpen }),
        setSelectedSkill: (selectedSkill) => set({ selectedSkill }),
        setSelectedDomain: (selectedDomain) => set({ selectedDomain }),
        setHasMastery: (hasMastery) => set({ hasMastery }),
        setRisk: (risk) => set({ risk }),
        pickSkill: (selectedSkill) => set({ isOpen: true, selectedSkill }),
        pickDomain: (selectedDomain) => set({ isOpen: true, selectedDomain }),
    })),
)
