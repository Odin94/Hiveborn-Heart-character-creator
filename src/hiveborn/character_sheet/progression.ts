import { applyTraitSelection, recordEarnedChanges } from "./traitGrants"
import { type Ability, type PickFromOption, type StaticBonuses } from "@/hiveborn/game_data/abilities"
import { type CharacterClass } from "@/hiveborn/game_data/classes"
import { type Calling } from "@/hiveborn/game_data/callings"
import { type Character, type Domains, type Skills, gainDomain, gainSkill } from "@/hiveborn/game_data/character"
import { isDomain } from "@/hiveborn/game_data/domains"
import { type Resistance, isResistance } from "@/hiveborn/game_data/resistances"
import { isSkill } from "@/hiveborn/game_data/skills"
import { hasTitledEntry, insertAbilityIntoText, markAbilityPicked } from "./markdown_formatting"

export const protectionMaximum = 5
export type Progression =
    | { type: "class"; characterClass: CharacterClass; pickedEquipment: string }
    | { type: "calling"; calling: Calling }
    | { type: "ability"; ability: Ability }
    | { type: "pick"; ability: Ability; selection: PickFromOption }

/** One rules operation produces one coherent sheet. Existing freeform entries stay intact. */
export function progressCharacter(character: Character, change: Progression): Character {
    if (change.type === "ability" && hasTitledEntry(character.abilities, change.ability.name)) return character
    if (change.type === "pick") {
        const options = change.ability.pickFrom
        if (![...options.skills, ...options.domains, ...options.protections].includes(change.selection)) return character
        if (!hasTitledEntry(character.abilities, change.ability.name)) return character
        if (markAbilityPicked(character.abilities, change.ability, change.selection) === character.abilities) return character
    }
    const draft = structuredClone(character)
    if (change.type === "class") {
        return applyTraitSelection(character, "class", change.characterClass, change.pickedEquipment)
    } else if (change.type === "calling") {
        return applyTraitSelection(character, "calling", change.calling)
    } else if (change.type === "ability") {
        draft.abilities = insertAbilityIntoText(draft.abilities, change.ability)
        applyStaticBonusesToDraft(draft.skills, draft.domains, draft.protections, change.ability.staticBonuses)
    } else {
        const selection = change.selection
        if (isSkill(selection)) draft.skills[selection] = gainSkill(draft.skills[selection])
        else if (isDomain(selection)) draft.domains[selection] = gainDomain(draft.domains[selection])
        else if (isResistance(selection)) draft.protections[selection] = Math.min(draft.protections[selection] + 1, protectionMaximum)
        draft.abilities = markAbilityPicked(draft.abilities, change.ability, selection)
    }
    return { ...draft, ...recordEarnedChanges(character, { skills: draft.skills, domains: draft.domains, protections: draft.protections }) }
}

const applyStaticBonusesToDraft = (skills: Skills, domains: Domains, protections: Record<Resistance, number>, bonuses: StaticBonuses) => {
    for (const skill of bonuses.skills) {
        skills[skill] = gainSkill(skills[skill])
    }

    for (const domain of bonuses.domains) {
        domains[domain] = gainDomain(domains[domain])
    }

    for (const { resistance, amount } of bonuses.protections) {
        protections[resistance] = Math.min(protections[resistance] + amount, protectionMaximum)
    }
}
