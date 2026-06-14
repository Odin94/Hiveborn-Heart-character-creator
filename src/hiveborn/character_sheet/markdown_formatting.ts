import { abilitiesByClassOrCalling, type Ability, type PickFromOption } from "@/hiveborn/game_data/abilities"
import { type Beat, type BeatType } from "@/hiveborn/game_data/beats"
import { type Fallout } from "@/hiveborn/game_data/fallout"
import { coreTraitsByCharacter } from "@/hiveborn/game_data/classes"

type AbilitySection = "core" | "minor" | "major" | "zenith" | "unknown"

const abilitySectionOrder: AbilitySection[] = ["core", "minor", "major", "zenith", "unknown"]

const abilitySectionByTitle = new Map<string, AbilitySection>()
for (const abilityList of Object.values(abilitiesByClassOrCalling)) {
    for (const ability of abilityList) {
        abilitySectionByTitle.set(normalizeTitle(ability.name), getAbilitySection(ability))
    }
}
for (const coreTraits of Object.values(coreTraitsByCharacter)) {
    for (const ability of coreTraits.abilities) {
        abilitySectionByTitle.set(normalizeTitle(ability.name), "core")
    }
}

export const formatRulesText = (text: string) => text.replace(/(^|[^A-Za-z])'([^'\n]+)'(?=[^A-Za-z]|$)/g, "$1`$2`")

export const formatTitledEntry = (title: string, description: string) => `**${title}** - ${formatRulesText(description)}`

export const formatAbilityEntry = (ability: Ability) => formatTitledEntry(ability.name, ability.description)

export const formatBeatEntry = (beat: Beat) => formatTitledEntry(capitalize(beat.type), beat.description)

export const formatFalloutEntry = (fallout: Fallout) => formatTitledEntry(fallout.name, fallout.description)

export const formatEquipmentEntry = (equipment: string) => {
    const normalizedEquipment = formatRulesText(equipment).trim()
    const equipmentParts = /^(.+?)\s+(\(.+\))$/.exec(normalizedEquipment)
    if (!equipmentParts) return normalizedEquipment

    return `**${equipmentParts[1].trim()}** - ${formatEquipmentTags(equipmentParts[2])}`
}

export const hasTitledEntry = (text: string, title: string) => {
    return getEntryTitles(text).some((entryTitle) => normalizeTitle(entryTitle) === normalizeTitle(title))
}

export const insertAbilityIntoText = (abilityText: string, ability: Ability) => {
    if (hasTitledEntry(abilityText, ability.name)) return abilityText

    const parsedSections = parseAbilitySections(abilityText)
    if (ability.parentName) {
        return addSubAbilityToParent(parsedSections, ability, abilityText)
    }

    parsedSections[getAbilitySection(ability)].push(formatAbilityEntry(ability))
    return renderAbilitySections(parsedSections)
}

export const markAbilityPicked = (abilityText: string, ability: Ability, selection: PickFromOption) => {
    const formattedDescription = formatRulesText(ability.description)
    const formattedSelection = formatRulesText(`${selection}`)
    const formattedPickedDescription = `${formattedDescription} (Picked \`${formattedSelection}\`)`

    if (abilityText.includes(formattedDescription)) return abilityText.replace(formattedDescription, formattedPickedDescription)

    return abilityText.replace(ability.description, formattedPickedDescription)
}

export function normalizeMarkdownText(text: string) {
    return text.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim().toLowerCase()
}

const parseAbilitySections = (abilityText: string) => {
    const sections = createEmptyAbilitySections()
    const entries = abilityText
        .split(/^\s*---+\s*$/m)
        .flatMap((sectionText) => sectionText.split(/\n{2,}/))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)

    for (const entry of entries) {
        sections[getEntrySection(entry)].push(entry)
    }

    return sections
}

const addSubAbilityToParent = (sections: Record<AbilitySection, string[]>, ability: Ability, originalAbilityText: string) => {
    const parentTitle = ability.parentName
    if (!parentTitle) return originalAbilityText

    const parentSection = sections.major
    const parentEntryIndex = parentSection.findIndex((entry) => hasTitledEntry(entry, parentTitle))
    if (parentEntryIndex === -1) {
        parentSection.push(formatAbilityEntry(ability))
        return renderAbilitySections(sections)
    }

    parentSection[parentEntryIndex] = `${parentSection[parentEntryIndex]} \n  - ${formatAbilityEntry(ability)}`
    return renderAbilitySections(sections)
}

const renderAbilitySections = (sections: Record<AbilitySection, string[]>) => {
    const nonEmptySections = abilitySectionOrder
        .map((section) => sections[section])
        .filter((sectionEntries) => sectionEntries.length > 0)
        .map((sectionEntries) => sectionEntries.join("\n\n"))

    return nonEmptySections.join(nonEmptySections.length > 1 ? "\n\n---\n\n" : "\n\n")
}

const createEmptyAbilitySections = (): Record<AbilitySection, string[]> => ({
    core: [],
    minor: [],
    major: [],
    zenith: [],
    unknown: [],
})

const getEntrySection = (entry: string): AbilitySection => {
    for (const title of getEntryTitles(entry)) {
        const section = abilitySectionByTitle.get(normalizeTitle(title))
        if (section) return section
    }

    return "unknown"
}

const getEntryTitles = (text: string) => {
    const titles: string[] = []
    for (const match of text.matchAll(/(?:^|\n)\s*(?:-\s*)?(?:\*\*)?(.+?)(?:\*\*)?\s+-\s+/g)) {
        titles.push(match[1])
    }
    return titles
}

function getAbilitySection(ability: Ability): AbilitySection {
    if (ability.type === "core") return "core"
    if (ability.type === "major" || ability.parentName) return "major"
    if (ability.type === "minor") return "minor"
    if (ability.type === "zenith") return "zenith"
    return "unknown"
}

const formatEquipmentTags = (text: string) => {
    return text
        .replace(/`([^`]+)`\s+(D\d+)/g, "`$1`, $2")
        .replace(/`\s+`/g, "`, `")
        .replace(/(D\d+)\s+`/g, "$1, `")
}

function normalizeTitle(title: string) {
    return normalizeMarkdownText(title)
}

function capitalize(text: BeatType) {
    return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`
}
