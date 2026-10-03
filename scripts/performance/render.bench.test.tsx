import { act, Profiler } from "react"
import { createRoot } from "react-dom/client"
import { expect, test, vi } from "vitest"
import CharacterSheet from "@/hiveborn/character_sheet/character_sheet"
import { useCharacterStore } from "@/hiveborn/character_sheet/character_states"
import { getEmptyCharacter } from "@/hiveborn/game_data/character"

const counters = vi.hoisted(() => ({ abilitiesUpdates: 0, tabsUpdates: 0 }))
vi.mock("@/hiveborn/character_sheet/components/abilities", async (importOriginal) => {
    const { default: Abilities } = await importOriginal<typeof import("../../src/hiveborn/character_sheet/components/abilities")>()
    return {
        default: () => (
            <Profiler
                id="abilities"
                onRender={(_, phase) => {
                    if (phase !== "mount") counters.abilitiesUpdates++
                }}
            >
                <Abilities />
            </Profiler>
        ),
    }
})
vi.mock("@/hiveborn/character_sheet/components/character_tabs", async (importOriginal) => {
    const { default: CharacterTabs } = await importOriginal<typeof import("../../src/hiveborn/character_sheet/components/character_tabs")>()
    return {
        default: (props: Parameters<typeof CharacterTabs>[0]) => (
            <Profiler
                id="tabs"
                onRender={(_, phase) => {
                    if (phase !== "mount") counters.tabsUpdates++
                }}
            >
                <CharacterTabs {...props} />
            </Profiler>
        ),
    }
})

vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture() {} }) }))

test("character sheet interaction benchmark", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    const durations: number[] = []
    const characters = Array.from({ length: 30 }, (_, index) => ({
        ...getEmptyCharacter(),
        name: `Witch ${index}`,
        characterClass: "Witch",
        abilities: Array.from(
            { length: 30 },
            (_, item) => `**Ability ${item}**\n\nRules for a spell with *power* and a [reference](https://example.com).`,
        ).join("\n\n"),
        equipment: "**Lantern**\n\nA light in the dark.",
    }))
    localStorage.clear()
    useCharacterStore.setState(useCharacterStore.getInitialState(), true)
    useCharacterStore.getState().setCloudCharacters(
        characters,
        characters.map(() => ""),
        characters.map(() => 0),
    )
    await act(() =>
        root.render(
            <Profiler
                id="sheet"
                onRender={(_, phase, duration) => {
                    if (phase !== "mount") durations.push(duration)
                }}
            >
                <CharacterSheet />
            </Profiler>,
        ),
    )
    try {
        for (const scenario of ["name", "equipment"] as const) {
            const rounds = []
            for (let round = 0; round < 6; round++) {
                durations.length = 0
                counters.abilitiesUpdates = 0
                counters.tabsUpdates = 0
                const started = performance.now()
                for (let index = 0; index < 30; index++) {
                    await act(() => {
                        if (scenario === "name") useCharacterStore.getState().setName(`Witch ${round}-${index}`)
                        else useCharacterStore.getState().setEquipment(`**Lantern ${round}-${index}**\n\nA light in the dark.`)
                    })
                }
                rounds.push({
                    elapsedMs: performance.now() - started,
                    commits: durations.length,
                    renderMs: durations.reduce((sum, duration) => sum + duration, 0),
                    ...counters,
                })
            }
            expect(container.querySelector("input")?.value).toBe("Witch 5-29")
            const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
            console.log(
                JSON.stringify({
                    benchmark: `sheet-${scenario}-edits`,
                    characters: 30,
                    editsPerSample: 30,
                    samples: rounds.slice(1),
                    medianElapsedMs: median(rounds.slice(1).map((round) => round.elapsedMs)),
                    medianRenderMs: median(rounds.slice(1).map((round) => round.renderMs)),
                }),
            )
        }
    } finally {
        await act(() => root.unmount())
        container.remove()
    }
}, 120_000)
