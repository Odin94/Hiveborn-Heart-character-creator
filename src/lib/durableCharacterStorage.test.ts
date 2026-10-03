import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { getEmptyCharacter } from "@/hiveborn/game_data/character"
import { browserWriterId, createDurableCharacterStorage, mergeBrowserCharacters } from "./durableCharacterStorage"
const key = "hiveborn-character-storage"
const character = { ...getEmptyCharacter(), name: "Original" }
const state = {
    characters: [character],
    currentCharacterIndex: 0,
    cloudCharacterIds: [""],
    cloudCharacterVersions: [0],
    cloudCharacterBases: [character],
    archivedCharacters: [],
}
const envelope = (value: typeof state) => JSON.stringify({ version: 1, state: value })
beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())
it("reads a durable writer journal missed by a racing canonical write and retains both disjoint changes", () => {
    localStorage.setItem(key, envelope(state))
    const a = createDurableCharacterStorage(localStorage, "a")
    const b = createDurableCharacterStorage(localStorage, "b")
    a.getItem(key)
    b.getItem(key)
    const staleCanonical = localStorage.getItem(key) as string
    a.setItem(key, envelope({ ...state, characters: [{ ...character, equipment: "Lantern" }] }))
    // Simulate a tab winning a race with its stale full-collection write.
    localStorage.setItem(key, staleCanonical)
    b.setItem(key, envelope({ ...state, characters: [{ ...character, name: "Renamed" }] }))
    const saved = JSON.parse(createDurableCharacterStorage(localStorage, "reload").getItem(key) as string).state
    expect(saved.characters).toHaveLength(1)
    expect(saved.characters[0]).toMatchObject({ name: "Renamed", equipment: "Lantern" })
})
it("preserves overlapping edits as stable distinct characters on reload and repeated reconciliation", () => {
    localStorage.setItem(key, envelope(state))
    const a = createDurableCharacterStorage(localStorage, "a")
    const b = createDurableCharacterStorage(localStorage, "b")
    a.getItem(key)
    b.getItem(key)
    a.setItem(key, envelope({ ...state, characters: [{ ...character, name: "Alice" }] }))
    b.setItem(key, envelope({ ...state, characters: [{ ...character, name: "Bob" }] }))
    const storage = createDurableCharacterStorage(localStorage, "reload")
    const saved = JSON.parse(storage.getItem(key) as string).state
    expect(saved.characters.map((entry: { name: string }) => entry.name).sort()).toEqual(["Alice", "Bob"])
    expect(JSON.parse(storage.getItem(key) as string).state.characters).toEqual(saved.characters)
})
it("keeps a deleted identity archived and forks a stale writer's unsaved edit", () => {
    const archive = { archiveId: crypto.randomUUID(), character, deletedAt: "now", cloudId: "", accountId: null, synced: false }
    const current = { ...state, characters: [], archivedCharacters: [archive] }
    const incoming = { ...state, characters: [{ ...character, equipment: "Valuable draft" }] }
    const result = mergeBrowserCharacters(state, current, incoming, "race")
    expect(result.archivedCharacters).toEqual([archive])
    expect(result.characters).toHaveLength(1)
    expect(result.characters![0]).toMatchObject({ equipment: "Valuable draft" })
    expect(result.characters![0].uuid).not.toBe(character.uuid)
})
it("journal count stays bounded while typing and storage failures leave the previous sheet recoverable", () => {
    localStorage.setItem(key, envelope(state))
    const storage = createDurableCharacterStorage(localStorage, "one-tab")
    storage.getItem(key)
    for (let index = 0; index < 100; index++) storage.setItem(key, envelope({ ...state, characters: [{ ...character, name: `Name ${index}` }] }))
    expect(localStorage.length).toBe(2)
    expect(JSON.parse(storage.getItem(key) as string).state.characters[0].name).toBe("Name 99")
})

it("compacts acknowledged journals and writer snapshots safely under Web Locks", async () => {
    vi.stubGlobal("navigator", { locks: { request: async (_name: string, callback: () => void) => callback() } })
    localStorage.setItem(key, envelope(state))
    const storage = createDurableCharacterStorage(localStorage, "reused-tab")
    storage.getItem(key)
    for (let index = 0; index < 100; index++) await storage.setItem(key, envelope({ ...state, characters: [{ ...character, name: `Name ${index}` }] }))
    expect(localStorage.length).toBe(1)
    expect(JSON.parse(localStorage.getItem(key)!).writers).toEqual({})
    expect(JSON.parse(storage.getItem(key) as string).state.characters[0].name).toBe("Name 99")
})
it("isolates corrupt recovery journals without losing or overwriting their raw bytes", () => {
    localStorage.setItem(key, envelope(state))
    localStorage.setItem("hiveborn-character-journal:broken", "{invalid")
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
        expect(JSON.parse(createDurableCharacterStorage(localStorage, "test").getItem(key) as string).state.characters).toEqual([character])
        expect(localStorage.getItem("hiveborn-character-journal:broken")).toBe("{invalid")
    } finally {
        warning.mockRestore()
    }
})
it("a journal write failure leaves the earlier canonical sheet intact", () => {
    localStorage.setItem(key, envelope(state))
    const storage = createDurableCharacterStorage(localStorage, "full")
    storage.getItem(key)
    const original = localStorage.getItem(key)
    const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError")
    })
    try {
        storage.setItem(key, envelope({ ...state, characters: [{ ...character, name: "Unsaved" }] }))
    } finally {
        failure.mockRestore()
    }
    expect(localStorage.getItem(key)).toBe(original)
})

it("never reuses writer identities cloned through sessionStorage", () => {
    sessionStorage.setItem("hiveborn-character-writer", "copied-id")
    const a = browserWriterId(),
        b = browserWriterId()
    expect(a).not.toBe(b)
    expect(a).not.toBe("copied-id")
    expect(b).not.toBe("copied-id")
})
it("recovers a journal-only first save after canonical storage rejects the write", async () => {
    const original = Storage.prototype.setItem
    const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, name, value) {
        if (name === key) throw new DOMException("Full", "QuotaExceededError")
        original.call(this, name, value)
    })
    try {
        const storage = createDurableCharacterStorage(localStorage, "first-save")
        storage.getItem(key)
        await storage.setItem(key, envelope(state))
        expect(localStorage.getItem(key)).toBe(null)
        expect(JSON.parse(createDurableCharacterStorage(localStorage, "reloaded").getItem(key) as string).state.characters).toEqual([character])
    } finally {
        failure.mockRestore()
    }
})
it("recovers valid journals around a corrupt canonical record and retains damaged original bytes", async () => {
    localStorage.setItem(key, "{corrupt-original")
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
        const storage = createDurableCharacterStorage(localStorage, "recover")
        storage.getItem(key)
        await storage.setItem(key, envelope(state))
        expect(JSON.parse(createDurableCharacterStorage(localStorage, "reload").getItem(key) as string).state.characters).toEqual([character])
        const backup = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)!).find((name) => name.startsWith(`${key}:damaged:`))!
        expect(localStorage.getItem(backup)).toBe("{corrupt-original")
    } finally {
        warning.mockRestore()
    }
})
