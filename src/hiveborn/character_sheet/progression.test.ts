import { beforeEach, expect, it } from "vitest"
import { getEmptyCharacter } from "@/hiveborn/game_data/character"
import { coreTraitsByCharacter } from "@/hiveborn/game_data/classes"
import { type Ability } from "@/hiveborn/game_data/abilities"
import { hasTitledEntry, formatEquipmentEntry, formatRulesText } from "./markdown_formatting"
import { useCharacterStore } from "./character_states"
import { progressCharacter } from "./progression"

beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState(useCharacterStore.getInitialState(), true)
})

it("publishes one complete sheet and one undo checkpoint for class or ability gains", () => {
    const original = getEmptyCharacter()
    useCharacterStore.getState().setCloudCharacters([original], [""], [0])
    const published: (typeof original)[] = []
    const unsubscribe = useCharacterStore.subscribe((state) => published.push(state.characters[0]))
    useCharacterStore.getState().applyProgression({ type: "class", characterClass: "Witch", pickedEquipment: coreTraitsByCharacter.Witch.pickEquipment[0] })
    unsubscribe()
    expect(published).toHaveLength(1)
    expect(published[0].characterClass).toBe("Witch")
    expect(published[0].skills.compel.hasSkill).toBe(true)
    expect(published[0].domains.occult.hasDomain).toBe(true)
    expect(hasTitledEntry(published[0].abilities, "Crucible")).toBe(true)
    expect(JSON.parse(localStorage.getItem("hiveborn-character-storage")!).state.characters[0]).toEqual(published[0])
    expect(useCharacterStore.getState().characterHistory).toHaveLength(1)
    useCharacterStore.getState().undoCharacterChange()
    expect(useCharacterStore.getState().characters).toEqual([original])
})

it("changes class while retaining calling gains, knacks, freeform content and unrelated sheet fields", () => {
    const original = { ...getEmptyCharacter(), equipment: "An heirloom", resources: "Private stash", abilities: "Personal lore", fallout: "Scar" }
    original.skills.discern.knacks = "Secrets"
    let sheet = progressCharacter(original, { type: "calling", calling: "Enlightenment" })
    sheet = progressCharacter(sheet, { type: "class", characterClass: "Junk Mage", pickedEquipment: coreTraitsByCharacter["Junk Mage"].pickEquipment[0] })
    expect(sheet.skills.discern.knacks).toBe("Secrets, <pick a knack>")
    sheet = progressCharacter(sheet, { type: "class", characterClass: "Witch", pickedEquipment: coreTraitsByCharacter.Witch.pickEquipment[0] })
    expect(sheet.skills.discern.hasSkill).toBe(true)
    expect(sheet.skills.discern.knacks).toBe("Secrets, <pick a knack>")
    expect(hasTitledEntry(sheet.abilities, "Unorthodox Methods")).toBe(true)
    expect(hasTitledEntry(sheet.abilities, "Sacrifice")).toBe(false)
    expect(sheet.abilities).toContain("Personal lore")
    expect(sheet.equipment).toContain("An heirloom")
    expect(sheet.equipment).not.toContain(formatEquipmentEntry(coreTraitsByCharacter["Junk Mage"].pickEquipment[0]))
    expect(sheet.resources).not.toContain(formatRulesText(coreTraitsByCharacter["Junk Mage"].resource))
    expect(sheet.resources).toContain("Private stash")
    expect(sheet.fallout).toBe("Scar")
    const reselected = progressCharacter(sheet, { type: "class", characterClass: "Witch", pickedEquipment: coreTraitsByCharacter.Witch.pickEquipment[0] })
    expect(reselected).toBe(sheet)
})

it("preserves class-provided skills when replacing a calling and removes its protection with a floor", () => {
    let sheet = progressCharacter(getEmptyCharacter(), { type: "class", characterClass: "Junk Mage", pickedEquipment: "" })
    sheet = progressCharacter(sheet, { type: "calling", calling: "Enlightenment" })
    sheet = progressCharacter(sheet, { type: "calling", calling: "Heartsong" })
    expect(sheet.skills.discern.hasSkill).toBe(true)
    expect(sheet.protections.echo).toBe(1)
    sheet.protections.echo = 0
    sheet = progressCharacter(sheet, { type: "calling", calling: "Adventure" })
    expect(sheet.protections.echo).toBe(0)
    expect(hasTitledEntry(sheet.abilities, "In the Blood")).toBe(false)
})

const ability: Ability = {
    name: "Trial [I]",
    description: "Gain power.\nChoose 'Hunt'.",
    type: "minor",
    staticBonuses: { skills: ["hunt"], domains: ["wild"], protections: [{ resistance: "blood", amount: 2 }] },
    pickFrom: { skills: ["hunt"], domains: [], protections: ["blood"] },
}

it("caps static and picked protections and applies each choice once, including multiline markdown", () => {
    const original = getEmptyCharacter()
    original.protections.blood = 4
    let sheet = progressCharacter(original, { type: "ability", ability })
    expect(sheet.protections.blood).toBe(5)
    expect(sheet.skills.hunt.hasSkill).toBe(true)
    expect(progressCharacter(sheet, { type: "ability", ability })).toBe(sheet)
    expect(progressCharacter(sheet, { type: "pick", ability, selection: "occult" })).toBe(sheet)
    sheet = progressCharacter(sheet, { type: "pick", ability, selection: "hunt" })
    expect(sheet.skills.hunt.knacks).toBe("<pick a knack>")
    expect(sheet.abilities).toContain("(Picked `hunt`)")
    expect(progressCharacter(sheet, { type: "pick", ability, selection: "hunt" })).toBe(sheet)
    expect(progressCharacter(sheet, { type: "pick", ability, selection: "blood" })).toBe(sheet)
    expect(original.protections.blood).toBe(4)
})

it("changing an applied class's equipment does not grant its calling-shared skill again", () => {
    let sheet = progressCharacter(getEmptyCharacter(), { type: "calling", calling: "Enlightenment" })
    const traits = coreTraitsByCharacter["Junk Mage"]
    sheet = progressCharacter(sheet, { type: "class", characterClass: "Junk Mage", pickedEquipment: traits.pickEquipment[0] })
    const knacks = sheet.skills.discern.knacks
    sheet.resources = "Consumed starting resource"
    const changed = progressCharacter(sheet, { type: "class", characterClass: "Junk Mage", pickedEquipment: traits.pickEquipment[1] })
    expect(changed.equipment).toContain(formatEquipmentEntry(traits.pickEquipment[1]))
    expect(changed.equipment).not.toContain(formatEquipmentEntry(traits.pickEquipment[0]))
    expect(changed.skills.discern.knacks).toBe(knacks)
    expect(changed.resources).toBe("Consumed starting resource")
})
