import { Ability, PickFromOption } from "@/hiveborn/game_data/abilities"
import { markAbilityPicked } from "@/hiveborn/character_sheet/markdown_formatting"
import { isDomain } from "@/hiveborn/game_data/domains"
import { isResistance } from "@/hiveborn/game_data/resistances"
import { isSkill } from "@/hiveborn/game_data/skills"
import { protectionMaximum, useCharacterStore } from "../character_states"

export const useApplyPickedBonus = () => {
    const existingSkills = useCharacterStore.use.skills()
    const setSkills = useCharacterStore.use.setSkills()
    const existingDomains = useCharacterStore.use.domains()
    const setDomains = useCharacterStore.use.setDomains()
    const zustandProtections = useCharacterStore.use.protections()
    const setProtections = useCharacterStore.use.setProtections()
    const abilities = useCharacterStore.use.abilities()
    const setAbilities = useCharacterStore.use.setAbilities()

    const applyPickedBonus = (selection: PickFromOption, pickingFromAbility: Ability) => {
        if (isSkill(selection)) {
            existingSkills[selection].hasSkill = true
            setSkills({ ...existingSkills })
        } else if (isDomain(selection)) {
            existingDomains[selection].hasDomain = true
            setDomains({ ...existingDomains })
        } else if (isResistance(selection)) {
            zustandProtections[selection] = Math.min(zustandProtections[selection] + 1, protectionMaximum)
            setProtections({ ...zustandProtections })
        }

        setAbilities(markAbilityPicked(abilities, pickingFromAbility, selection))
    }
    return applyPickedBonus
}
