import { gainDomain, gainSkill, type Character, type TraitGrants } from "@/hiveborn/game_data/character"
import { coreTraitsByCharacter, type CharacterClass } from "@/hiveborn/game_data/classes"
import type { Calling } from "@/hiveborn/game_data/callings"
import { abilitiesByClassOrCalling } from "@/hiveborn/game_data/abilities"
import {
    formatEquipmentEntry,
    formatRulesText,
    hasTitledEntry,
    insertAbilityIntoText,
    removeEquipmentEntriesFromText,
    removeMarkdownEntriesFromText,
    removeTitledEntriesFromText,
} from "./markdown_formatting"

const baseline = (character: Character): TraitGrants => ({
    skills: Object.fromEntries(Object.entries(character.skills).map(([key, skill]) => [key, skill.hasSkill])),
    domains: Object.fromEntries(Object.entries(character.domains).map(([key, domain]) => [key, domain.hasDomain])),
    protections: { ...character.protections },
    sources: {},
})

export function applyTraitSelection(character: Character, kind: "class" | "calling", selection: CharacterClass | Calling, pickedEquipment = ""): Character {
    const next = structuredClone(character)
    const grants = next.traitGrants ?? baseline(next)
    const previous = grants.sources[kind]
    if (previous?.selection === selection) return next
    // Only remove entries this app actually inserted. Legacy or independently earned entries stay intact.
    if (previous) {
        next.abilities = removeTitledEntriesFromText(next.abilities, previous.abilities)
        next.equipment = removeEquipmentEntriesFromText(next.equipment, previous.equipment)
        next.resources = removeMarkdownEntriesFromText(next.resources, previous.resources)
    }
    const traits = kind === "class" ? coreTraitsByCharacter[selection as CharacterClass] : null
    const abilities = traits?.abilities ?? [abilitiesByClassOrCalling[selection as Calling][0]]
    const source: NonNullable<TraitGrants["sources"]["class"]> = {
        selection,
        skills: [...new Set([...(traits ? [traits.skill] : []), ...abilities.flatMap((ability) => ability.staticBonuses.skills)])],
        domains: [...new Set([...(traits ? [traits.domain] : []), ...abilities.flatMap((ability) => ability.staticBonuses.domains)])],
        protections: abilities.flatMap((ability) => ability.staticBonuses.protections),
        abilities: [],
        equipment: [],
        resources: [],
    }
    for (const ability of abilities) {
        if (!hasTitledEntry(next.abilities, ability.name)) {
            next.abilities = insertAbilityIntoText(next.abilities, ability)
            source.abilities.push(ability.name)
        }
    }
    for (const equipment of traits ? [pickedEquipment, traits.equipment] : []) {
        if (!equipment || next.equipment.includes(equipment) || next.equipment.includes(formatEquipmentEntry(equipment))) continue
        next.equipment = `${formatEquipmentEntry(equipment)}\n\n${next.equipment}`
        source.equipment.push(equipment)
    }
    if (traits && !next.resources.includes(traits.resource) && !next.resources.includes(formatRulesText(traits.resource))) {
        next.resources = `${formatRulesText(traits.resource)}\n\n${next.resources}`
        source.resources.push(traits.resource)
    }
    const otherSources = Object.entries(grants.sources)
        .filter(([key]) => key !== kind)
        .map(([, value]) => value)
    for (const skill of source.skills) {
        const alreadyTrained = grants.skills[skill] || otherSources.some((entry) => entry!.skills.includes(skill))
        next.skills[skill] = gainSkill({ ...next.skills[skill], hasSkill: alreadyTrained })
    }
    for (const domain of source.domains) {
        const alreadyTrained = grants.domains[domain] || otherSources.some((entry) => entry!.domains.includes(domain))
        next.domains[domain] = gainDomain({ ...next.domains[domain], hasDomain: alreadyTrained })
    }
    grants.sources[kind] = source
    const sources = Object.values(grants.sources)
    for (const [skill, value] of Object.entries(next.skills)) value.hasSkill = grants.skills[skill] || sources.some((entry) => entry.skills.includes(skill))
    for (const [domain, value] of Object.entries(next.domains))
        value.hasDomain = grants.domains[domain] || sources.some((entry) => entry.domains.includes(domain))
    for (const resistance of Object.keys(next.protections) as Array<keyof Character["protections"]>) {
        const amount = sources
            .flatMap((entry) => entry.protections)
            .filter((entry) => entry.resistance === resistance)
            .reduce((total, entry) => total + entry.amount, 0)
        next.protections[resistance] = Math.min(5, Math.max(0, grants.protections[resistance] + amount))
    }
    next.traitGrants = grants
    if (kind === "class") next.characterClass = selection
    else next.calling = selection
    return next
}

/** Manual changes adjust earned data; grants remain independent of the displayed selection text. */
export function recordEarnedChanges(character: Character, updates: Partial<Character>): Partial<Character> {
    if (!character.traitGrants) return updates
    const grants = structuredClone(character.traitGrants)
    for (const [key, value] of Object.entries(updates.skills ?? {})) {
        if (value.hasSkill !== character.skills[key].hasSkill || value.knacks !== character.skills[key].knacks) grants.skills[key] = value.hasSkill
    }
    for (const [key, value] of Object.entries(updates.domains ?? {})) {
        if (value.hasDomain !== character.domains[key].hasDomain || value.knacks !== character.domains[key].knacks) grants.domains[key] = value.hasDomain
    }
    for (const resistance of Object.keys(updates.protections ?? {}) as Array<keyof Character["protections"]>) {
        grants.protections[resistance] = Math.max(
            0,
            Math.min(5, grants.protections[resistance] + updates.protections![resistance] - character.protections[resistance]),
        )
    }
    return { ...updates, traitGrants: grants }
}
