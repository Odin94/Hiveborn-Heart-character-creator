import { StaticBonuses } from "@/hiveborn/game_data/abilities"
import { gainDomain, gainSkill } from "@/hiveborn/game_data/character"
import { protectionMaximum, useCharacterStore } from "../character_states"

export const useApplyStaticBonuses = () => {
    const existingSkills = useCharacterStore.use.skills()
    const setSkills = useCharacterStore.use.setSkills()
    const existingDomains = useCharacterStore.use.domains()
    const setDomains = useCharacterStore.use.setDomains()
    const zustandProtections = useCharacterStore.use.protections()
    const setProtections = useCharacterStore.use.setProtections()

    const applyStaticBonuses = ({ domains, skills, protections }: StaticBonuses) => {
        const updatedDomains = { ...existingDomains }
        for (const domain of domains) {
            updatedDomains[domain] = gainDomain(updatedDomains[domain])
        }
        setDomains(updatedDomains)

        const updatedSkills = { ...existingSkills }
        for (const skill of skills) {
            updatedSkills[skill] = gainSkill(updatedSkills[skill])
        }
        setSkills(updatedSkills)

        const updatedProtections = { ...zustandProtections }
        for (const { resistance, amount } of protections) {
            updatedProtections[resistance] = Math.min(updatedProtections[resistance] + amount, protectionMaximum)
        }
        setProtections(updatedProtections)
    }
    return applyStaticBonuses
}
