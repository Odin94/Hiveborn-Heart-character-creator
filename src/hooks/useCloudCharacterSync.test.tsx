import { act, StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { getEmptyCharacter } from "@/hiveborn/game_data/character"
import { api } from "@/lib/api"
import { useCloudCharacterSync } from "./useCloudCharacterSync"

vi.mock("@/lib/api", () => ({
    API_URL: "http://localhost:3000",
    api: { characters: vi.fn(), createCharacter: vi.fn(), updateCharacter: vi.fn(), deleteCharacter: vi.fn() },
    tokenStorage: { get: () => null },
}))

let root: Root
let container: HTMLDivElement
const storageKey = "hiveborn-character-storage"

function Sync({ accountId }: { accountId?: string }) {
    useCloudCharacterSync(accountId)
    const name = useCharacterStore.use.name()
    return <span>{name}</span>
}

beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    localStorage.clear()
    vi.resetAllMocks()
    useCharacterStore.setState(useCharacterStore.getInitialState(), true)
    container = document.createElement("div")
    document.body.append(container)
    root = createRoot(container)
})

afterEach(async () => {
    await act(() => root.unmount())
    container.remove()
})

it.each([false, true])("preserves browser-only sheets across reloads (previous cloud account: %s)", async (previousAccount) => {
    const first = { ...getEmptyCharacter(), name: "Honey Witch", equipment: "Lantern", abilities: "Swarm" }
    const second = { ...getEmptyCharacter(), name: "Deep Apiarist", activeBeats: "Find the hive", fallout: "Marked" }
    second.stress.blood = 4
    second.skills.delve = { hasSkill: true, knacks: "Tunnels" }
    second.domains.warren = { hasDomain: true, knacks: "Hives" }
    second.protections.mind = 2
    useCharacterStore.getState().setCloudCharacters([first, second], ["", ""], [0, 0])
    useCharacterStore.getState().setCurrentCharacter(1)
    const saved = localStorage.getItem(storageKey)!
    if (previousAccount) localStorage.setItem(`hiveborn-cloud-character-account:${window.location.origin}`, "old-account")

    // Recreate startup: discard memory, hydrate saved browser data, mount sync.
    useCharacterStore.setState(useCharacterStore.getInitialState(), true)
    localStorage.setItem(storageKey, saved)
    await useCharacterStore.persist.rehydrate()
    await act(() =>
        root.render(
            <StrictMode>
                <Sync />
            </StrictMode>,
        ),
    )

    expect(container.textContent).toBe(second.name)
    expect(useCharacterStore.getState().characters).toEqual([first, second])
    expect(useCharacterStore.getState().currentCharacterIndex).toBe(1)
    expect(localStorage.getItem(storageKey)).toBe(saved)
    expect(api.characters).not.toHaveBeenCalled()
    expect(api.createCharacter).not.toHaveBeenCalled()

    await act(() => useCharacterStore.getState().setEquipment("New lantern"))
    expect(JSON.parse(localStorage.getItem(storageKey)!).state.characters[1].equipment).toBe("New lantern")
})

it("preserves sheets while authentication loads and after sign-out", async () => {
    const character = { ...getEmptyCharacter(), name: "Signed-in Witch" }
    useCharacterStore.getState().setCloudCharacters([character], ["sheet-1"], [1])
    localStorage.setItem(`hiveborn-cloud-character-account:${window.location.origin}`, "account-1")
    vi.mocked(api.characters).mockResolvedValue({ characters: [{ id: "sheet-1", data: character, version: 1 }] } as Awaited<ReturnType<typeof api.characters>>)

    await act(async () => root.render(<Sync />))
    expect(container.textContent).toBe(character.name)
    await act(async () => root.render(<Sync accountId="account-1" />))
    expect(container.textContent).toBe(character.name)
    await act(async () => root.render(<Sync />))
    expect(useCharacterStore.getState().characters).toEqual([character])
})

it.each([false, true])("uploads browser sheets when signing into an account with existing sheets: %s", async (existing) => {
    vi.useFakeTimers()
    try {
        const browser = { ...getEmptyCharacter(), name: "Browser Witch", equipment: "Local lantern" }
        const other = { ...getEmptyCharacter(), name: "Second browser sheet" }
        const cloud = { ...getEmptyCharacter(), name: "Cloud Witch" }
        const row = (id: string, data: typeof browser) => ({ id, data, name: data.name, version: 1, updatedAt: "" })
        useCharacterStore.getState().setCloudCharacters([browser, other], ["", ""], [0, 0])
        useCharacterStore.getState().setCurrentCharacter(1)
        // A stale account marker must not prevent anonymous sheets being saved.
        localStorage.setItem(`hiveborn-cloud-character-account:${window.location.origin}`, "old-account")
        vi.mocked(api.characters).mockResolvedValue({ characters: existing ? [row("cloud", cloud)] : [] })
        vi.mocked(api.createCharacter).mockImplementation(async (data) => row(`saved-${data.name}`, data))
        await act(async () => root.render(<Sync />))
        await act(async () => root.render(<Sync accountId="new-account" />))
        expect(useCharacterStore.getState().characters).toEqual(existing ? [browser, other, cloud] : [browser, other])
        expect(container.textContent).toBe(other.name)
        await act(async () => vi.advanceTimersByTimeAsync(700))
        expect(api.createCharacter).toHaveBeenCalledTimes(2)
        expect(api.createCharacter).toHaveBeenCalledWith(browser)
        expect(api.createCharacter).toHaveBeenCalledWith(other)
        expect(JSON.parse(localStorage.getItem(storageKey)!).state.cloudCharacterIds.slice(0, 2)).toEqual([`saved-${browser.name}`, `saved-${other.name}`])
        // Remounting after login must not upload the same sheets again.
        vi.mocked(api.characters).mockResolvedValue({
            characters: [row(`saved-${browser.name}`, browser), row(`saved-${other.name}`, other), ...(existing ? [row("cloud", cloud)] : [])],
        })
        await act(async () => root.render(<></>))
        await act(async () => root.render(<Sync accountId="new-account" />))
        await act(async () => vi.advanceTimersByTimeAsync(700))
        expect(api.createCharacter).toHaveBeenCalledTimes(2)
        expect(container.textContent).toBe(other.name)
    } finally {
        vi.useRealTimers()
    }
})

it("keeps browser edits made while sign-in is loading and when the request fails", async () => {
    const browser = { ...getEmptyCharacter(), name: "Browser Witch" }
    useCharacterStore.getState().setCloudCharacters([browser], [""], [0])
    let reject!: (error: Error) => void
    vi.mocked(api.characters).mockReturnValue(
        new Promise((_resolve, rejectRequest) => {
            reject = rejectRequest
        }),
    )
    await act(async () => root.render(<Sync accountId="new-account" />))
    await act(async () => useCharacterStore.getState().setEquipment("Edited during login"))
    await act(async () => reject(new Error("Offline")))
    expect(useCharacterStore.getState().name).toBe(browser.name)
    expect(JSON.parse(localStorage.getItem(storageKey)!).state.characters[0].equipment).toBe("Edited during login")
})

it("retains local data after a failed upload and retries saving it", async () => {
    vi.useFakeTimers()
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
        const browser = { ...getEmptyCharacter(), name: "Offline Witch", abilities: "Keep me" }
        useCharacterStore.getState().setCloudCharacters([browser], [""], [0])
        vi.mocked(api.characters).mockResolvedValue({ characters: [] })
        vi.mocked(api.createCharacter)
            .mockRejectedValueOnce(new Error("Offline"))
            .mockResolvedValue({ id: "saved", data: browser, name: browser.name, version: 1, updatedAt: "" })
        await act(async () => root.render(<Sync accountId="new-account" />))
        await act(async () => vi.advanceTimersByTimeAsync(700))
        expect(JSON.parse(localStorage.getItem(storageKey)!).state.characters).toEqual([browser])
        expect(useCharacterStore.getState().cloudCharacterIds).toEqual([""])
        await act(async () => vi.advanceTimersByTimeAsync(2000))
        expect(api.createCharacter).toHaveBeenCalledTimes(2)
        expect(useCharacterStore.getState().cloudCharacterIds).toEqual(["saved"])
        expect(useCharacterStore.getState().characters).toEqual([browser])
    } finally {
        warning.mockRestore()
        vi.useRealTimers()
    }
})

it("ignores a sign-in response after logout and preserves browser data", async () => {
    const browser = { ...getEmptyCharacter(), name: "Keep on logout" }
    useCharacterStore.getState().setCloudCharacters([browser], [""], [0])
    let resolve!: (value: Awaited<ReturnType<typeof api.characters>>) => void
    vi.mocked(api.characters).mockReturnValue(
        new Promise((done) => {
            resolve = done
        }),
    )
    await act(async () => root.render(<Sync accountId="first-account" />))
    await act(async () => root.render(<Sync />))
    await act(async () => resolve({ characters: [] }))
    expect(useCharacterStore.getState().characters).toEqual([browser])
    expect(api.createCharacter).not.toHaveBeenCalled()
})

it("switches accounts during an upload without applying the old account's response", async () => {
    const browser = { ...getEmptyCharacter(), name: "Switching accounts" }
    useCharacterStore.getState().setCloudCharacters([browser], [""], [0])
    const saved = (uuid: string) => ({ id: uuid, name: browser.name, data: { ...browser, uuid }, version: 1, updatedAt: "" })
    const secondId = crypto.randomUUID()
    let finishFirst!: (value: Awaited<ReturnType<typeof api.createCharacter>>) => void
    vi.mocked(api.characters).mockResolvedValue({ characters: [] })
    vi.mocked(api.createCharacter)
        .mockReturnValueOnce(
            new Promise((resolve) => {
                finishFirst = resolve
            }),
        )
        .mockResolvedValueOnce(saved(secondId))
    await act(async () => root.render(<Sync accountId="first-account" />))
    await act(async () => root.render(<Sync accountId="second-account" />))
    await act(async () => finishFirst(saved(browser.uuid)))
    expect(useCharacterStore.getState().characters).toEqual([saved(secondId).data])
    expect(useCharacterStore.getState().cloudAccountId).toBe("second-account")
    expect(useCharacterStore.getState().cloudCharacterIds).toEqual([secondId])
})

it("soft-deletes a character removed during upload without touching other sheets", async () => {
    vi.useFakeTimers()
    try {
        const browser = { ...getEmptyCharacter(), name: "Delete in flight" }
        const remaining = { ...getEmptyCharacter(), name: "Keep me" }
        useCharacterStore.getState().setCloudCharacters([browser, remaining], ["", ""], [0, 0])
        const row = (data: typeof browser) => ({ id: data.uuid, name: data.name, data, version: 1, updatedAt: "" })
        let finish!: (value: Awaited<ReturnType<typeof api.createCharacter>>) => void
        vi.mocked(api.characters).mockResolvedValue({ characters: [] })
        vi.mocked(api.createCharacter)
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    finish = resolve
                }),
            )
            .mockImplementation(async (data) => row(data))
        vi.mocked(api.deleteCharacter).mockResolvedValue({ success: true, character: { ...row(browser), deletedAt: new Date().toISOString() } })
        await act(async () => root.render(<Sync accountId="owner" />))
        await act(async () => useCharacterStore.getState().removeCharacter(0))
        await act(async () => finish(row(browser)))
        await act(async () => vi.advanceTimersByTimeAsync(700))
        expect(api.deleteCharacter).toHaveBeenCalledExactlyOnceWith(browser.uuid)
        expect(useCharacterStore.getState().characters).toEqual([remaining])
        expect(useCharacterStore.getState().archivedCharacters[0].character).toEqual(browser)
        expect(useCharacterStore.getState().archivedCharacters[0].synced).toBe(true)
    } finally {
        vi.useRealTimers()
    }
})

it("saves edits made during upload after the backend changes the UUID", async () => {
    vi.useFakeTimers()
    try {
        const browser = { ...getEmptyCharacter(), name: "Editing in flight" }
        const remapped = { ...browser, uuid: crypto.randomUUID() }
        const row = (data: typeof browser) => ({ id: data.uuid, name: data.name, data, version: 1, updatedAt: "" })
        useCharacterStore.getState().setCloudCharacters([browser], [""], [0])
        let finish!: (value: Awaited<ReturnType<typeof api.createCharacter>>) => void
        vi.mocked(api.characters).mockResolvedValue({ characters: [] })
        vi.mocked(api.createCharacter).mockReturnValue(
            new Promise((resolve) => {
                finish = resolve
            }),
        )
        vi.mocked(api.updateCharacter).mockImplementation(async (_id, payload) => row({ ...payload.baseData, ...payload.changes }))
        await act(async () => root.render(<Sync accountId="owner" />))
        await act(async () => useCharacterStore.getState().setEquipment("Unsaved edit"))
        await act(async () => vi.advanceTimersByTimeAsync(1000))
        await act(async () => finish(row(remapped)))
        await act(async () => vi.advanceTimersByTimeAsync(700))
        expect(api.updateCharacter).toHaveBeenCalledWith(remapped.uuid, expect.objectContaining({ changes: { equipment: "Unsaved edit" } }))
        expect(useCharacterStore.getState().characters).toEqual([{ ...remapped, equipment: "Unsaved edit" }])
    } finally {
        vi.useRealTimers()
    }
})

it("keeps another account's offline deletion archived without sending a delete as the new account", async () => {
    const browser = { ...getEmptyCharacter(), name: "First account sheet" }
    useCharacterStore.getState().setCloudCharacters([browser], [browser.uuid], [1])
    useCharacterStore.setState({ cloudAccountId: "first-account" })
    useCharacterStore.getState().removeCharacter(0)
    vi.mocked(api.characters).mockResolvedValue({ characters: [] })
    vi.mocked(api.createCharacter).mockImplementation(async (data) => ({ id: data.uuid, data, name: data.name, version: 1, updatedAt: "" }))
    await act(async () => root.render(<Sync accountId="second-account" />))
    expect(api.deleteCharacter).not.toHaveBeenCalled()
    expect(useCharacterStore.getState().archivedCharacters[0]).toMatchObject({ character: browser, accountId: "first-account", synced: false })
})
