import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { getEmptyCharacter } from "@/hiveborn/game_data/character"
import { useCharacterStore } from "../../character_states"
import StressRollDialog from "./stress_roll_dialog"
vi.mock("../dice_roller/dice/animated_die", () => ({ default: () => null }))
vi.mock("../dice_roller/dice_scene", () => ({ default: () => null }))
vi.mock("../dice_roller/roll_utils", () => ({ dieSizes: [6], rollDice: () => [{ id: 1, value: 6, sides: 6, removed: false }] }))
let root: Root, container: HTMLDivElement
beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    useCharacterStore.setState(useCharacterStore.getInitialState(), true)
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    container = document.createElement("div")
    document.body.append(container)
    root = createRoot(container)
})
afterEach(async () => {
    await act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
})
it.each([false, true])("a delayed roll follows its UUID after selection/deletion (deleted: %s)", async (deleted) => {
    const a = { ...getEmptyCharacter(), name: "A" },
        b = { ...getEmptyCharacter(), name: "B" }
    useCharacterStore.getState().setCloudCharacters([a, b], ["", ""], [0, 0])
    await act(async () => root.render(<StressRollDialog resistance="blood" onClose={() => {}} onRollingChange={() => {}} />))
    const button = [...document.querySelectorAll("button")].find((button) => button.textContent === "d6")!
    await act(async () => button.click())
    await act(async () => (deleted ? useCharacterStore.getState().removeCharacter(0) : useCharacterStore.getState().setCurrentCharacter(1)))
    await act(async () => vi.advanceTimersByTimeAsync(1600))
    const state = useCharacterStore.getState()
    expect(state.characters.find((entry) => entry.uuid === b.uuid)?.stress.blood).toBe(0)
    if (deleted) expect(state.archivedCharacters[0].character.stress.blood).toBe(0)
    else expect(state.characters.find((entry) => entry.uuid === a.uuid)?.stress.blood).toBe(6)
})
