import { act, Profiler } from "react"
import { createRoot } from "react-dom/client"
import { expect, test, vi } from "vitest"
import GroupOverview from "@/hiveborn/play_mode/group_overview"
import { api, type PlayGroup, type User } from "@/lib/api"
import { getEmptyCharacter } from "@/hiveborn/game_data/character"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"

const counter = vi.hoisted(() => ({ markdownRenders: 0 }))
vi.mock("@/components/ui/markdown", async (importOriginal) => {
    const { Markdown } = await importOriginal<typeof import("../../src/components/ui/markdown")>()
    return {
        Markdown: (props: Parameters<typeof Markdown>[0]) => {
            counter.markdownRenders++
            return <Markdown {...props} />
        },
    }
})
vi.mock("@/lib/api", () => ({ API_URL: "http://localhost:3312", tokenStorage: { get: () => null }, api: { groups: vi.fn(), characters: vi.fn() } }))

test("mounted Play Mode workloads", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const start = new Date("2026-10-03T10:00:00Z").getTime()
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
    vi.setSystemTime(start)
    const user = { id: "owner", nickname: "Keeper" } as User
    const members = Array.from({ length: 30 }, (_, index) => ({
        id: index === 0 ? user.id : `user-${index}`,
        nickname: `Player ${index}`,
        joinedAt: new Date(start).toISOString(),
        isGameMaster: index === 0,
        isOnline: true,
        characters: [
            {
                id: `sheet-${index}`,
                name: `Witch ${index}`,
                version: 1,
                updatedAt: new Date(start).toISOString(),
                data: {
                    ...getEmptyCharacter(),
                    name: `Witch ${index}`,
                    characterClass: "Witch",
                    fallout: "**Battered** - Bruised by the Heart.",
                    activeBeats: "**Discover** a strange secret.",
                    equipment: "Brutal lantern",
                    resources: "D6 Occult relic",
                    stress: { ...getEmptyCharacter().stress, blood: 3 },
                },
            },
        ],
    }))
    let groups = Array.from({ length: 12 }, (_, index) => ({
        id: `group-${index}`,
        name: `Table ${index}`,
        ownerId: user.id,
        createdAt: new Date(start).toISOString(),
        members,
        rolls: Array.from({ length: 200 }, (_, roll) => ({
            id: `roll-${roll}`,
            characterId: `sheet-${roll % 30}`,
            characterName: `Witch ${roll % 30}`,
            label: "Delve",
            dice: "2d10",
            result: "7",
            createdAt: new Date(start - roll * 500).toISOString(),
        })),
    })) as PlayGroup[]
    vi.mocked(api.groups).mockImplementation(async () => ({
        groups,
        invitations: [
            {
                group: { id: "invite", name: "Invited table", ownerId: "other", createdAt: new Date(start).toISOString() },
                invitedByNickname: "Friend",
                createdAt: new Date(start).toISOString(),
            },
        ],
    }))
    vi.mocked(api.characters).mockResolvedValue({ characters: members[0].characters } as Awaited<ReturnType<typeof api.characters>>)
    useCharacterStore.setState(useCharacterStore.getInitialState(), true)
    useCharacterStore.getState().setCloudCharacters(
        members[0].characters.map((entry) => entry.data),
        ["sheet-0"],
        [1],
    )
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    const durations: number[] = []
    const onClose = vi.fn(),
        onSelectGroup = vi.fn()
    await act(async () =>
        root.render(
            <Profiler
                id="play"
                onRender={(_, phase, duration) => {
                    if (phase !== "mount") durations.push(duration)
                }}
            >
                <GroupOverview user={user} selectedGroupId="group-0" onClose={onClose} onSelectGroup={onSelectGroup} />
            </Profiler>,
        ),
    )
    expect(container.querySelectorAll("article").length).toBe(30)
    const nativeSetValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    try {
        for (const scenario of ["invite-input", "group-name-input", "roll-age-tick", "local-equipment-update", "live-sheet-update", "group-switch"] as const) {
            const samples = []
            for (let round = 0; round < 4; round++) {
                counter.markdownRenders = 0
                durations.length = 0
                const started = performance.now()
                for (let index = 0; index < 10; index++) {
                    await act(() => {
                        if (scenario === "live-sheet-update") {
                            groups = groups.map((group, groupIndex) =>
                                groupIndex !== 0
                                    ? group
                                    : {
                                          ...group,
                                          members: group.members.map((member, memberIndex) =>
                                              memberIndex !== 1
                                                  ? member
                                                  : {
                                                        ...member,
                                                        characters: member.characters.map((character) => ({
                                                            ...character,
                                                            name: `Updated ${round}-${index}`,
                                                            data: {
                                                                ...character.data,
                                                                name: `Updated ${round}-${index}`,
                                                                fallout: `Changed ${round}-${index}`,
                                                            },
                                                            version: character.version + 1,
                                                        })),
                                                    },
                                          ),
                                      },
                            )
                            window.dispatchEvent(new Event("focus"))
                        } else if (scenario === "group-switch")
                            root.render(
                                <Profiler
                                    id="play"
                                    onRender={(_, phase, duration) => {
                                        if (phase !== "mount") durations.push(duration)
                                    }}
                                >
                                    <GroupOverview user={user} selectedGroupId={`group-${index % 2}`} onClose={onClose} onSelectGroup={onSelectGroup} />
                                </Profiler>,
                            )
                        else if (scenario === "roll-age-tick") vi.advanceTimersByTime(10_000)
                        else if (scenario === "local-equipment-update") useCharacterStore.getState().setEquipment(`Lantern ${round}-${index}`)
                        else {
                            const input = container.querySelector<HTMLInputElement>(
                                scenario === "invite-input" ? 'input[placeholder="Player nickname"]' : 'input[placeholder="New group name"]',
                            )!
                            nativeSetValue.call(input, `Value ${round}-${index}`)
                            input.dispatchEvent(new Event("input", { bubbles: true }))
                        }
                    })
                }
                if (scenario === "live-sheet-update") expect(container.textContent).toContain(`Updated ${round}-9`)
                if (scenario === "group-switch") expect(container.textContent).toContain("Table 1")
                samples.push({
                    elapsedMs: performance.now() - started,
                    renderMs: durations.reduce((sum, value) => sum + value, 0),
                    commits: durations.length,
                    markdownRenders: counter.markdownRenders,
                })
            }
            if (scenario.endsWith("input")) expect(samples[1].commits).toBeGreaterThan(0)
            const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
            console.log(
                JSON.stringify({
                    benchmark: `play-${scenario}`,
                    characters: 30,
                    groups: 12,
                    rolls: 200,
                    updatesPerSample: 10,
                    samples: samples.slice(1),
                    medianRenderMs: median(samples.slice(1).map((sample) => sample.renderMs)),
                    medianElapsedMs: median(samples.slice(1).map((sample) => sample.elapsedMs)),
                }),
            )
        }
    } finally {
        await act(() => root.unmount())
        container.remove()
        vi.useRealTimers()
    }
}, 120_000)
