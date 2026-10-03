import { beforeEach, expect, it } from "vitest"
import { getEmptyCharacter } from "../game_data/character"
import { useCharacterStore } from "./character_states"
import { applyTraitSelection, recordEarnedChanges } from "./traitGrants"
beforeEach(() => {
    localStorage.clear()
    useCharacterStore.setState(useCharacterStore.getInitialState(), true)
})
it("retains independently earned Hunt and knacks while replacing the class", () => {
    const character = getEmptyCharacter()
    character.skills.hunt = { hasSkill: true, knacks: "Tracking" }
    const cleaver = applyTraitSelection(character, "class", "Cleaver")
    const deadwalker = applyTraitSelection(cleaver, "class", "Deadwalker")
    expect(deadwalker.skills.hunt.hasSkill).toBe(true)
    expect(deadwalker.skills.hunt.knacks).toContain("Tracking")
    expect(deadwalker.characterClass).toBe("Deadwalker")
})
it("never infers grants from an unapplied or legacy class label", () => {
    const character = getEmptyCharacter()
    character.characterClass = "Cleaver"
    character.skills.hunt.hasSkill = true
    expect(applyTraitSelection(character, "class", "Deadwalker").skills.hunt.hasSkill).toBe(true)
})
it("removes only known class grants, preserves manual advancement, and repeated Apply is idempotent", () => {
    const cleaver = applyTraitSelection(getEmptyCharacter(), "class", "Cleaver")
    expect(applyTraitSelection(cleaver, "class", "Cleaver")).toEqual(cleaver)
    const earned = { ...cleaver, ...recordEarnedChanges(cleaver, { skills: { ...cleaver.skills, hunt: { hasSkill: true, knacks: "Advanced" } } }) }
    expect(applyTraitSelection(earned, "class", "Deadwalker").skills.hunt).toEqual({ hasSkill: true, knacks: "Advanced" })
    expect(applyTraitSelection(cleaver, "class", "Deadwalker").skills.hunt.hasSkill).toBe(false)
})
it("one Apply creates one undo checkpoint and targets the selected UUID", () => {
    const store = useCharacterStore
    const first = getEmptyCharacter(),
        second = getEmptyCharacter()
    store.getState().setCloudCharacters([first, second], ["", ""], [0, 0])
    store.getState().setCurrentCharacter(1)
    store.getState().applyTraits(first.uuid, "class", "Cleaver")
    expect(store.getState().characters[0].characterClass).toBe("Cleaver")
    expect(store.getState().characters[1]).toEqual(second)
    expect(store.getState().characterHistory).toHaveLength(1)
    store.getState().undoCharacterChange()
    expect(store.getState().characters).toEqual([first, second])
})

it("a new grant to an already trained skill still awards one knack prompt", () => {
    const character = getEmptyCharacter()
    character.skills.hunt = { hasSkill: true, knacks: "Tracking" }
    const cleaver = applyTraitSelection(character, "class", "Cleaver")
    expect(cleaver.skills.hunt.knacks).toBe("Tracking, <pick a knack>")
    expect(applyTraitSelection(cleaver, "class", "Cleaver").skills.hunt.knacks).toBe(cleaver.skills.hunt.knacks)
})
