import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import GroupOverview from "./group_overview"
import { api, type PlayGroup, type User } from "@/lib/api"
import { getEmptyCharacter } from "@/hiveborn/game_data/character"

vi.mock("./fallout_die", () => {
    throw new Error("Animation chunk unavailable")
})
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))
vi.mock("@/lib/api", () => ({
    API_URL: "http://localhost:3312",
    tokenStorage: { get: () => null },
    api: { groups: vi.fn(), characters: vi.fn(), falloutRoll: vi.fn() },
}))

it("reconciles successful fallout stress changes when the optional animation chunk fails", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    let data = { ...getEmptyCharacter(), name: "Witch", stress: { ...getEmptyCharacter().stress, blood: 5 } }
    const groups = () =>
        [
            {
                id: "table",
                name: "Table",
                ownerId: "owner",
                createdAt: new Date().toISOString(),
                members: [
                    {
                        id: "owner",
                        nickname: "Keeper",
                        joinedAt: new Date().toISOString(),
                        isOnline: true,
                        isGameMaster: true,
                        characters: [{ id: "sheet", name: "Witch", data, version: 1, updatedAt: new Date().toISOString() }],
                    },
                ],
                rolls: [],
            },
        ] as PlayGroup[]
    vi.mocked(api.groups).mockImplementation(async () => ({ groups: groups(), invitations: [] }))
    vi.mocked(api.characters).mockResolvedValue({ characters: [] })
    vi.mocked(api.falloutRoll).mockImplementation(async () => {
        data = { ...data, stress: { ...data.stress, blood: 0 } }
        return {
            roll: 2,
            totalStress: 5,
            fallout: "minor",
            stressUpdate: { type: "all" },
            characterId: "sheet",
            stressUpdated: true,
            lastStressResistance: "blood",
        } as Awaited<ReturnType<typeof api.falloutRoll>>
    })
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    try {
        await act(async () => root.render(<GroupOverview user={{ id: "owner" } as User} selectedGroupId="table" onClose={() => {}} onSelectGroup={() => {}} />))
        const button = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Roll fallout"))!
        expect(button.disabled).toBe(false)
        await act(async () => {
            button.click()
            await vi.waitFor(() => expect(api.groups).toHaveBeenCalledTimes(2))
        })
        expect(api.falloutRoll).toHaveBeenCalledOnce()
        expect(api.groups).toHaveBeenCalledTimes(2)
        expect(button.disabled).toBe(true)
        expect(container.querySelector("article")?.textContent).toContain("0 stress")
    } finally {
        await act(() => root.unmount())
        container.remove()
    }
})

it("refreshes an open shared sheet and updates permissions when switching tables", async () => {
    let data = { ...getEmptyCharacter(), name: "Shared Witch", abilities: "Old ability" }
    const groups = () =>
        [
            {
                id: "table",
                name: "First table",
                ownerId: "owner",
                createdAt: new Date().toISOString(),
                members: [
                    {
                        id: "other",
                        nickname: "Other player",
                        joinedAt: new Date().toISOString(),
                        isOnline: true,
                        isGameMaster: false,
                        characters: [{ id: "sheet", name: data.name, data, version: 1, updatedAt: new Date().toISOString() }],
                    },
                    { id: "owner", nickname: "Keeper", joinedAt: new Date().toISOString(), isOnline: true, isGameMaster: true, characters: [] },
                ],
                rolls: [],
            },
            { id: "other-table", name: "Second table", ownerId: "other", createdAt: new Date().toISOString(), members: [], rolls: [] },
        ] as PlayGroup[]
    vi.mocked(api.groups).mockImplementation(async () => ({ groups: groups(), invitations: [] }))
    vi.mocked(api.characters).mockResolvedValue({ characters: [] })
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    const user = { id: "owner" } as User
    const onClose = vi.fn(),
        onSelectGroup = vi.fn()
    try {
        await act(async () => root.render(<GroupOverview user={user} selectedGroupId="table" onClose={onClose} onSelectGroup={onSelectGroup} />))
        const button = Array.from(container.querySelectorAll("button")).find((entry) => entry.textContent === "View sheet")!
        await act(() => button.click())
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Old ability")
        data = { ...data, name: "Updated Witch", abilities: "Fresh ability" }
        await act(async () => window.dispatchEvent(new Event("focus")))
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Fresh ability")
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Updated Witch")
        await act(async () => root.render(<GroupOverview user={user} selectedGroupId="other-table" onClose={onClose} onSelectGroup={onSelectGroup} />))
        expect(document.querySelector('[role="dialog"]')).toBeNull()
        expect(container.textContent).toContain("Second table")
        expect(container.textContent).not.toContain("Auto-update stress after fallout")
    } finally {
        await act(() => root.unmount())
        container.remove()
    }
})
