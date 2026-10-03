import { abilitiesByClassOrCalling, type Ability, type PickFromOption, type StaticBonuses } from "@/hiveborn/game_data/abilities"
import { type CharacterClass, type CoreTraits, coreTraitsByCharacter, isCharacterClass } from "@/hiveborn/game_data/classes"
import { type Calling, isCalling } from "@/hiveborn/game_data/callings"
import { type Character, type Domains, type Skills, gainDomain, gainSkill } from "@/hiveborn/game_data/character"
import { type DomainKey, isDomain } from "@/hiveborn/game_data/domains"
import { type Resistance, isResistance } from "@/hiveborn/game_data/resistances"
import { type SkillKey, isSkill } from "@/hiveborn/game_data/skills"
import {
    formatEquipmentEntry,
    formatRulesText,
    hasTitledEntry,
    insertAbilityIntoText,
    markAbilityPicked,
    removeEquipmentEntriesFromText,
    removeMarkdownEntriesFromText,
    removeTitledEntriesFromText,
} from "./markdown_formatting"

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
        const traits = coreTraitsByCharacter[change.characterClass]
        const alreadyApplied = character.characterClass === change.characterClass && traits.abilities.every((a) => hasTitledEntry(character.abilities, a.name))
        const selectedEquipment = [change.pickedEquipment, traits.equipment].filter(Boolean)
        if (
            alreadyApplied &&
            selectedEquipment.every((equipment) => character.equipment.includes(equipment) || character.equipment.includes(formatEquipmentEntry(equipment)))
        )
            return character
        const previous = isCharacterClass(character.characterClass) ? coreTraitsByCharacter[character.characterClass] : null
        draft.characterClass = change.characterClass
        if (previous && !alreadyApplied) {
            draft.abilities = removeTitledEntriesFromText(
                draft.abilities,
                previous.abilities.map((a) => a.name),
            )
            draft.resources = removeMarkdownEntriesFromText(draft.resources, [previous.resource])
            removeClassBonusesFromDraft(
                draft.skills,
                draft.domains,
                draft.protections,
                previous,
                getCallingAbility(draft.calling)?.staticBonuses ?? emptyStaticBonuses(),
            )
        }
        if (previous) draft.equipment = removeEquipmentEntriesFromText(draft.equipment, [previous.equipment, ...previous.pickEquipment].filter(Boolean))
        for (const ability of traits.abilities) draft.abilities = insertAbilityIntoText(draft.abilities, ability)
        for (const equipment of [change.pickedEquipment, traits.equipment]) {
            if (!equipment) continue
            const formatted = formatEquipmentEntry(equipment)
            if (!draft.equipment.includes(equipment) && !draft.equipment.includes(formatted)) draft.equipment = `${formatted}\n\n${draft.equipment}`
        }
        // Changing the equipment choice for an applied class does not grant its
        // skill/domain bonuses again or replenish a consumed starting resource.
        if (alreadyApplied) return draft
        const resource = formatRulesText(traits.resource)
        if (!draft.resources.includes(traits.resource) && !draft.resources.includes(resource)) draft.resources = `${resource}\n\n${draft.resources}`
        applyClassBonusesToDraft(draft.skills, draft.domains, draft.protections, traits)
    } else if (change.type === "calling") {
        const ability = abilitiesByClassOrCalling[change.calling][0]
        if (character.calling === change.calling && hasTitledEntry(character.abilities, ability.name)) return character
        const previous = getCallingAbility(character.calling)
        draft.calling = change.calling
        if (previous) {
            draft.abilities = removeTitledEntriesFromText(draft.abilities, [previous.name])
            removeStaticBonusesFromDraft(
                draft.skills,
                draft.domains,
                draft.protections,
                previous.staticBonuses,
                getClassProvidedBonuses(isCharacterClass(draft.characterClass) ? coreTraitsByCharacter[draft.characterClass] : null),
            )
        }
        draft.abilities = insertAbilityIntoText(draft.abilities, ability)
        applyStaticBonusesToDraft(draft.skills, draft.domains, draft.protections, ability.staticBonuses)
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
    return draft
}

const emptyStaticBonuses = (): StaticBonuses => ({ domains: [], skills: [], protections: [] })

const getCallingAbility = (calling: string) => {
    return isCalling(calling) ? abilitiesByClassOrCalling[calling][0] : null
}

const applyClassBonusesToDraft = (skills: Skills, domains: Domains, protections: Record<Resistance, number>, coreTraits: CoreTraits) => {
    skills[coreTraits.skill] = gainSkill(skills[coreTraits.skill])
    domains[coreTraits.domain] = gainDomain(domains[coreTraits.domain])

    for (const ability of coreTraits.abilities) {
        applyStaticBonusesToDraft(skills, domains, protections, ability.staticBonuses)
    }
}

const removeClassBonusesFromDraft = (
    skills: Skills,
    domains: Domains,
    protections: Record<Resistance, number>,
    coreTraits: CoreTraits,
    preservedBonuses: StaticBonuses,
) => {
    if (!preservedBonuses.skills.includes(coreTraits.skill)) {
        skills[coreTraits.skill].hasSkill = false
    }
    if (!preservedBonuses.domains.includes(coreTraits.domain)) {
        domains[coreTraits.domain].hasDomain = false
    }

    for (const ability of coreTraits.abilities) {
        removeStaticBonusesFromDraft(skills, domains, protections, ability.staticBonuses, preservedBonuses)
    }
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

const removeStaticBonusesFromDraft = (
    skills: Skills,
    domains: Domains,
    protections: Record<Resistance, number>,
    bonuses: StaticBonuses,
    preservedBonuses: StaticBonuses,
) => {
    const preservedSkills = new Set<SkillKey>(preservedBonuses.skills)
    const preservedDomains = new Set<DomainKey>(preservedBonuses.domains)
    const preservedProtections = new Set<Resistance>(preservedBonuses.protections.map(({ resistance }) => resistance))

    for (const skill of bonuses.skills) {
        if (!preservedSkills.has(skill)) {
            skills[skill].hasSkill = false
        }
    }

    for (const domain of bonuses.domains) {
        if (!preservedDomains.has(domain)) {
            domains[domain].hasDomain = false
        }
    }

    for (const { resistance, amount } of bonuses.protections) {
        if (!preservedProtections.has(resistance)) {
            protections[resistance] = Math.max(0, protections[resistance] - amount)
        }
    }
}

const getClassProvidedBonuses = (coreTraits: CoreTraits | null): StaticBonuses => {
    if (!coreTraits) return emptyStaticBonuses()

    return {
        skills: [coreTraits.skill, ...coreTraits.abilities.flatMap((ability) => ability.staticBonuses.skills)],
        domains: [coreTraits.domain, ...coreTraits.abilities.flatMap((ability) => ability.staticBonuses.domains)],
        protections: coreTraits.abilities.flatMap((ability) => ability.staticBonuses.protections),
    }
}
