import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useCharacterStore as store } from "@/hiveborn/character_sheet/character_states"
import { getEmptyCharacter, type Character } from "@/hiveborn/game_data/character"
import { startCharacterSync, receiveRemoteCharacter, acknowledgeCharacter, type CharacterTransport } from "./characterSync"
import type { CloudCharacter } from "./api"

const row = (data: Character, version = 1): CloudCharacter => ({ id: data.uuid, name: data.name, data, version, updatedAt: "" })
const deferred = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}
const transport = (): CharacterTransport => ({
    characters: vi.fn(async () => ({ characters: [] })),
    createCharacter: vi.fn(async (data) => row(data)),
    updateCharacter: vi.fn(async (id, payload) => ({ ...row({ ...payload.baseData, ...payload.changes }, payload.baseVersion + 1), id })),
    deleteCharacter: vi.fn(async () => ({ success: true })),
})
let sessions: ReturnType<typeof startCharacterSync>[]
beforeEach(() => {
    localStorage.clear()
    store.setState(store.getInitialState(), true)
    vi.useFakeTimers()
    sessions = []
})
afterEach(() => {
    sessions.forEach((session) => session.stop())
    vi.useRealTimers()
})
const start = (account: string, port: CharacterTransport, onFailure?: (error: unknown, first: boolean) => void) => {
    const session = startCharacterSync(account, port, { onFailure })
    sessions.push(session)
    return session
}

it("flushes edits and refreshes received while an upload outlasts the debounce", async () => {
    const sheet = { ...getEmptyCharacter(), name: "First" }
    store.getState().setCloudCharacters([sheet], [""], [0])
    const pending = deferred<CloudCharacter>()
    const port = transport()
    vi.mocked(port.createCharacter).mockReturnValueOnce(pending.promise)
    const sync = start("owner", port)
    await vi.advanceTimersByTimeAsync(0)
    store.getState().setEquipment("During upload")
    sync.refresh()
    await vi.advanceTimersByTimeAsync(1000)
    expect(port.createCharacter).toHaveBeenCalledTimes(1)
    // A refresh discovers the original server base, and retains local edits.
    vi.mocked(port.characters).mockResolvedValue({ characters: [row(sheet)] })
    pending.resolve(row(sheet))
    await vi.advanceTimersByTimeAsync(700)
    expect(port.characters).toHaveBeenCalledTimes(2)
    expect(port.updateCharacter).toHaveBeenCalledExactlyOnceWith(sheet.uuid, expect.objectContaining({ changes: { equipment: "During upload" } }))
    expect(store.getState().characters[0].equipment).toBe("During upload")
    expect(store.getState().cloudCharacterVersions).toEqual([2])
})

it("retains a remapped upload identity for a delete made just before logout, then deletes it on re-login", async () => {
    const sheet = { ...getEmptyCharacter(), name: "Delete pending" }
    const saved = { ...sheet, uuid: crypto.randomUUID() }
    store.getState().setCloudCharacters([sheet], [""], [0])
    const pending = deferred<CloudCharacter>()
    const first = transport()
    vi.mocked(first.createCharacter).mockReturnValueOnce(pending.promise)
    const sync = start("owner", first)
    await vi.advanceTimersByTimeAsync(0)
    store.getState().removeCharacter(0)
    sync.stop()
    pending.resolve(row(saved))
    await vi.advanceTimersByTimeAsync(0)
    expect(store.getState().archivedCharacters[0]).toMatchObject({ cloudId: saved.uuid, accountId: "owner", synced: false, character: saved })
    const second = transport()
    vi.mocked(second.characters).mockResolvedValue({ characters: [row(saved)] })
    start("owner", second)
    await vi.advanceTimersByTimeAsync(0)
    expect(second.deleteCharacter).toHaveBeenCalledExactlyOnceWith(saved.uuid)
    expect(store.getState().archivedCharacters[0].synced).toBe(true)
    expect(store.getState().characters.some((character) => character.uuid === saved.uuid)).toBe(false)
})

it("retires account responses and remote observation without changing local ownership", async () => {
    const sheet = { ...getEmptyCharacter(), name: "Browser" }
    store.getState().setCloudCharacters([sheet], [""], [0])
    const firstResponse = deferred<{ characters: CloudCharacter[] }>()
    const first = transport()
    const stopObservation = vi.fn()
    first.observe = vi.fn(() => stopObservation)
    vi.mocked(first.characters).mockReturnValueOnce(firstResponse.promise)
    const old = start("old", first)
    old.stop()
    const current = transport()
    start("new", current)
    await vi.advanceTimersByTimeAsync(0)
    firstResponse.resolve({ characters: [row({ ...sheet, equipment: "Wrong account" })] })
    await vi.advanceTimersByTimeAsync(2000)
    expect(stopObservation).toHaveBeenCalledTimes(1)
    expect(first.createCharacter).not.toHaveBeenCalled()
    expect(store.getState().cloudAccountId).toBe("new")
    expect(store.getState().characters).toEqual([sheet])
})

it("retries durable deletes and acknowledges 404 without losing the recovery copy", async () => {
    const sheet = { ...getEmptyCharacter(), name: "Recover me" }
    store.getState().setCloudCharacters([sheet], [sheet.uuid], [1])
    store.setState({ cloudAccountId: "owner" })
    store.getState().removeCharacter(0)
    const port = transport()
    vi.mocked(port.characters).mockResolvedValue({ characters: [row(sheet)] })
    vi.mocked(port.deleteCharacter)
        .mockRejectedValueOnce(new Error("Offline"))
        .mockRejectedValueOnce(Object.assign(new Error("Gone"), { status: 404 }))
    const failed = vi.fn()
    start("owner", port, failed)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.getState().archivedCharacters[0].synced).toBe(false)
    expect(JSON.parse(localStorage.getItem("hiveborn-character-storage")!).state.archivedCharacters[0].character).toEqual(sheet)
    await vi.advanceTimersByTimeAsync(2000)
    expect(port.deleteCharacter).toHaveBeenCalledTimes(2)
    expect(store.getState().archivedCharacters[0]).toMatchObject({ character: sheet, synced: true })
    expect(failed).toHaveBeenCalledExactlyOnceWith(expect.any(Error), true)
})

it("uses account and version ownership for group events and preserves pending local edits", () => {
    const sheet = { ...getEmptyCharacter(), name: "Group sheet" }
    store.getState().setCloudCharacters([sheet], [sheet.uuid], [1])
    store.setState({ cloudAccountId: "owner" })
    receiveRemoteCharacter(row({ ...sheet, equipment: "Wrong account" }, 2), "other")
    expect(store.getState().equipment).toBe("")
    receiveRemoteCharacter(row({ ...sheet, equipment: "Latest" }, 3), "owner")
    receiveRemoteCharacter(row({ ...sheet, equipment: "Stale" }, 2), "owner")
    expect(store.getState().equipment).toBe("Latest")
    store.getState().setEquipment("Local pending")
    receiveRemoteCharacter(row({ ...sheet, equipment: "Concurrent" }, 4), "owner")
    expect(store.getState().equipment).toBe("Local pending")
    expect(store.getState().cloudCharacterVersions).toEqual([3])
})

it("ends typing undo groups when an acknowledged sheet receives authoritative changes", () => {
    const sheet = { ...getEmptyCharacter(), name: "Original" }
    store.getState().setCloudCharacters([sheet], [sheet.uuid], [1])
    store.setState({ cloudAccountId: "owner" })
    store.getState().setName("First edit")
    const submitted = store.getState().characters[0]
    acknowledgeCharacter(submitted, row(submitted, 2), "owner")
    receiveRemoteCharacter(row({ ...submitted, fallout: "GM assigned fallout" }, 3), "owner")
    store.getState().setName("Second edit")
    store.getState().undoCharacterChange()
    expect(store.getState().name).toBe("First edit")
    expect(store.getState().fallout).toBe("GM assigned fallout")
    expect(store.getState().cloudCharacterVersions).toEqual([3])
})
