import { act, StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { getEmptyCharacter } from "@/hiveborn/game_data/character"
import { api } from "@/lib/api"
import { useCloudCharacterSync } from "./useCloudCharacterSync"

vi.mock("@/lib/api", () => ({
    API_URL: "http://localhost:3000",
    api: { characters: vi.fn(), createCharacter: vi.fn() },
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
    vi.clearAllMocks()
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

it("preserves sheets while authentication loads and still clears them on actual sign-out", async () => {
    const character = { ...getEmptyCharacter(), name: "Signed-in Witch" }
    useCharacterStore.getState().setCloudCharacters([character], ["sheet-1"], [1])
    localStorage.setItem(`hiveborn-cloud-character-account:${window.location.origin}`, "account-1")
    vi.mocked(api.characters).mockResolvedValue({ characters: [{ id: "sheet-1", data: character, version: 1 }] } as Awaited<ReturnType<typeof api.characters>>)

    await act(async () => root.render(<Sync />))
    expect(container.textContent).toBe(character.name)
    await act(async () => root.render(<Sync accountId="account-1" />))
    expect(container.textContent).toBe(character.name)
    await act(async () => root.render(<Sync />))
    expect(useCharacterStore.getState().characters).toEqual([getEmptyCharacter()])
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
