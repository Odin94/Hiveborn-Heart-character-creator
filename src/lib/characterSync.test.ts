import { beforeEach, expect, it } from "vitest"
import { getEmptyCharacter, characterSchema } from "@/hiveborn/game_data/character"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { acknowledgeCharacter, acknowledgeDeletion, reconcileCharacters, sameCharacter } from "./characterSync"
import type { CloudCharacter } from "./api"

const store = useCharacterStore
const sheet = (name: string) => ({ ...getEmptyCharacter(), name })
const cloud = (character: ReturnType<typeof sheet>, id = character.uuid, deletedAt: string | null = null): CloudCharacter => ({
    id,
    data: character,
    version: 1,
    name: character.name,
    updatedAt: "",
    deletedAt,
})
beforeEach(() => {
    localStorage.clear()
    store.setState(store.getInitialState(), true)
})

it("migrates legacy browser sheets and persists stable UUIDs without changing content or selection", async () => {
    const { uuid: _uuid, ...legacy } = sheet("Legacy")
    const { uuid: _otherUuid, ...other } = sheet("Other legacy")
    localStorage.setItem("hiveborn-character-storage", JSON.stringify({ version: 0, state: { characters: [legacy, other], currentCharacterIndex: 1 } }))
    await store.persist.rehydrate()
    const migrated = store.getState().characters
    expect(migrated).toHaveLength(2)
    expect(migrated[0]).toMatchObject(legacy)
    expect(migrated[1]).toMatchObject(other)
    expect(migrated[0].uuid).not.toBe(migrated[1].uuid)
    expect(characterSchema.shape.uuid.safeParse(migrated[0].uuid).success).toBe(true)
    expect(store.getState().name).toBe(other.name)
    await store.persist.rehydrate()
    expect(store.getState().characters).toEqual(migrated)
})

it("migrates a legacy single-sheet storage record", async () => {
    const { uuid: _uuid, ...legacy } = sheet("Single old sheet")
    localStorage.setItem("hiveborn-character-storage", JSON.stringify({ version: 0, state: legacy }))
    await store.persist.rehydrate()
    expect(store.getState().characters[0]).toMatchObject(legacy)
    expect(store.getState().name).toBe(legacy.name)
})

it("imports legacy JSON, deduplicates identical UUIDs, and keeps differing imports as new characters", () => {
    const original = sheet("Existing")
    store.getState().setCloudCharacters([original], [""], [0])
    const { uuid: _uuid, ...legacy } = sheet("Imported")
    const imported = characterSchema.parse(legacy)
    store.getState().importCharacter(imported)
    store.getState().importCharacter(imported)
    store.getState().importCharacter({ ...imported, equipment: "Different equipment" })
    expect(store.getState().characters).toHaveLength(3)
    expect(store.getState().characters[0]).toEqual(original)
    expect(new Set(store.getState().characters.map((character) => character.uuid)).size).toBe(3)
    expect(store.getState().characters[2].equipment).toBe("Different equipment")
})

it.each(["new account", "same account", "different account"])("merges local-only and cloud-only UUIDs for %s", (account) => {
    const local = sheet("Browser")
    const remote = sheet("Cloud")
    store.getState().setCloudCharacters([local], [account === "new account" ? "" : "old-id"], [1])
    store.setState({ cloudAccountId: account === "same account" ? "owner" : "other" })
    reconcileCharacters([cloud(remote)], "owner")
    expect(store.getState().characters).toEqual([local, remote])
    expect(store.getState().cloudCharacterIds).toEqual(["", remote.uuid])
    expect(store.getState().currentCharacterIndex).toBe(0)
})

it.each([false, true])("preserves both differing UUID-matched versions (known base: %s)", (knownBase) => {
    const original = sheet("Original")
    const local = { ...original, equipment: "Local equipment" }
    const remote = { ...original, equipment: "Remote equipment" }
    store.getState().setCloudCharacters([local], ["db-id"], [1])
    store.setState({ cloudAccountId: knownBase ? "owner" : null, cloudCharacterBases: [original] })
    reconcileCharacters([cloud(remote, "db-id")], "owner")
    const state = store.getState()
    expect(state.characters.map((character) => character.equipment)).toEqual(["Local equipment", "Remote equipment"])
    expect(state.characters[0].uuid).not.toBe(original.uuid)
    expect(state.characters[1].uuid).toBe(original.uuid)
    expect(state.cloudCharacterIds).toEqual(["", "db-id"])
    expect(state.name).toBe(local.name)
})

it("matches legacy cloud IDs while adopting the server UUID and keeping offline edits", () => {
    const local = sheet("Old browser")
    const remote = { ...local, uuid: crypto.randomUUID() }
    store.getState().setCloudCharacters([local], ["legacy-db-id"], [1])
    store.setState({ cloudAccountId: "owner" })
    store.getState().setEquipment("Offline equipment")
    reconcileCharacters([cloud(remote, "legacy-db-id")], "owner")
    expect(store.getState().characters).toEqual([{ ...remote, equipment: "Offline equipment" }])
    expect(store.getState().cloudCharacterBases).toEqual([remote])
})

it("never overwrites edits or the wrong sheet when an upload remaps a UUID", () => {
    const first = sheet("First")
    const second = sheet("Second")
    store.getState().setCloudCharacters([first, second], ["", ""], [0, 0])
    store.getState().setEquipment("Edited during upload")
    store.getState().setCurrentCharacter(1)
    const saved = { ...first, uuid: crypto.randomUUID(), fallout: "Remote field" }
    acknowledgeCharacter(first, cloud(saved), "owner")
    expect(store.getState().characters).toEqual([{ ...saved, equipment: "Edited during upload" }, second])
    expect(store.getState().name).toBe(second.name)
})

it("soft-deletes during upload, retains the cloud deletion queue on reload, and restores a new UUID", async () => {
    const first = sheet("Deleted")
    const second = sheet("Selected")
    store.getState().setCloudCharacters([first, second], ["", ""], [0, 0])
    store.getState().setCurrentCharacter(1)
    store.getState().removeCharacter(0)
    expect(store.getState().name).toBe(second.name)
    const saved = { ...first, uuid: crypto.randomUUID() }
    acknowledgeCharacter(first, cloud(saved), "owner")
    await store.persist.rehydrate()
    const archived = store.getState().archivedCharacters[0]
    expect(archived.cloudId).toBe(saved.uuid)
    expect(archived.accountId).toBe("owner")
    expect(archived.synced).toBe(false)
    expect(sameCharacter(archived.character, first)).toBe(true)
    acknowledgeDeletion(archived.archiveId, cloud(saved, saved.uuid, new Date().toISOString()))
    store.getState().restoreCharacter(archived.archiveId)
    expect(sameCharacter(store.getState().characters[1], first)).toBe(true)
    expect(store.getState().characters[1].uuid).not.toBe(saved.uuid)
    expect(store.getState().archivedCharacters).toHaveLength(1)
})

it.each([false, true])("remote soft-deletion archives the sheet and keeps conflicting local edits: %s", (edited) => {
    const original = sheet("Deleted remotely")
    store.getState().setCloudCharacters([{ ...original, equipment: edited ? "Offline edits" : original.equipment }], [original.uuid], [1])
    store.setState({ cloudAccountId: "owner" })
    reconcileCharacters([cloud(original, original.uuid, new Date().toISOString())], "owner")
    expect(store.getState().archivedCharacters[0].character).toEqual(original)
    if (edited) {
        expect(store.getState().characters[0].equipment).toBe("Offline edits")
        expect(store.getState().characters[0].uuid).not.toBe(original.uuid)
    } else expect(store.getState().characters.some((character) => character.uuid === original.uuid)).toBe(false)
})

it("keeps offline deletions pending while preserving a conflicting cloud version", () => {
    const original = sheet("Deleted offline")
    store.getState().setCloudCharacters([original], [original.uuid], [1])
    store.setState({ cloudAccountId: "owner" })
    store.getState().removeCharacter(0)
    reconcileCharacters([cloud({ ...original, equipment: "Other device edit" })], "owner")
    expect(store.getState().characters[0].equipment).toBe("Other device edit")
    expect(store.getState().characters[0].uuid).not.toBe(original.uuid)
    expect(store.getState().archivedCharacters[0].character).toEqual(original)
    expect(store.getState().archivedCharacters[0].synced).toBe(false)
})

it("reset archives the complete sheet durably before creating a new character", async () => {
    const original = { ...sheet("Reset me"), abilities: "Valuable notes" }
    store.getState().setCloudCharacters([original], [""], [0])
    store.getState().resetCharacter()
    await store.persist.rehydrate()
    expect(store.getState().archivedCharacters[0].character).toEqual(original)
    expect(store.getState().characters[0].uuid).not.toBe(original.uuid)
    expect(store.getState().characters[0].name).toBe("")
})

it("undoing deletion restores a new identity that cannot be removed by the pending cloud delete", () => {
    const original = sheet("Undo delete")
    store.getState().setCloudCharacters([original], [original.uuid], [1])
    store.setState({ cloudAccountId: "owner" })
    store.getState().removeCharacter(0)
    store.getState().undoCharacterChange()
    expect(sameCharacter(store.getState().characters[0], original)).toBe(true)
    expect(store.getState().characters[0].uuid).not.toBe(original.uuid)
    expect(store.getState().cloudCharacterIds).toEqual([""])
    expect(store.getState().archivedCharacters[0].character).toEqual(original)
})

it("reimporting a deleted UUID preserves the archive and creates a new active identity", () => {
    const original = sheet("Reimport delete")
    store.getState().setCloudCharacters([original], [""], [0])
    store.getState().removeCharacter(0)
    store.getState().importCharacter(original)
    expect(store.getState().characters[0].uuid).not.toBe(original.uuid)
    expect(sameCharacter(store.getState().characters[0], original)).toBe(true)
    expect(store.getState().archivedCharacters[0].character).toEqual(original)
})

it("recovers a pending deletion when the upload succeeded but its response was lost", () => {
    const original = sheet("Lost upload response")
    store.getState().setCloudCharacters([original], [""], [0])
    store.getState().removeCharacter(0)
    reconcileCharacters([cloud(original)], "owner")
    expect(store.getState().characters.some((character) => character.uuid === original.uuid)).toBe(false)
    expect(store.getState().archivedCharacters[0]).toMatchObject({ cloudId: original.uuid, accountId: "owner", synced: false, character: original })
})
