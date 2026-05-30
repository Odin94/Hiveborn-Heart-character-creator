import { RollRisk } from "../../dice_roller_state"
import { DieRoll, DieSize, RollResult } from "./types"

export const dieSizes: DieSize[] = [4, 6, 8, 10, 12]
export const maxFreeDiceCount = 12

export const getResult = (value: number): RollResult => {
    if (value === 1) {
        return { value, title: "Crit fail", description: "Fail & double stress" }
    }
    if (value <= 5) {
        return { value, title: "Failure", description: "Fail & stress" }
    }
    if (value <= 7) {
        return { value, title: "Success at cost", description: "Succeed & stress" }
    }
    if (value <= 9) {
        return { value, title: "Success", description: "Succeed & no stress" }
    }
    return { value, title: "Crit success", description: "Increase outgoing stress dice by 1 step" }
}

export const getRemovedIndexes = (values: number[], risk: RollRisk) => {
    const removeCount = risk === "dangerous" ? 2 : risk === "risky" ? 1 : 0
    if (removeCount === 0) return new Set<number>()

    const indexesByHighest = values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index)

    const maxRemovable = Math.max(0, values.length - 1)
    return new Set(indexesByHighest.slice(0, Math.min(removeCount, maxRemovable)).map(({ index }) => index))
}

export const createPendingDice = (count: number, sides: DieSize): DieRoll[] =>
    Array.from({ length: count }, (_, index) => ({
        id: -(index + 1),
        value: sides,
        sides,
        removed: false,
    }))

export const rollDice = (count: number, sides: DieSize, getRemovedIndexSet: (values: number[]) => Set<number> = () => new Set<number>()): DieRoll[] => {
    const values = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
    const removedIndexes = getRemovedIndexSet(values)

    return values.map((value, index) => ({ id: Date.now() + index, value, sides, removed: removedIndexes.has(index) }))
}

export const capitalize = (value: string) => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
