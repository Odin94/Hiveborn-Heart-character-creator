export type RollOutcome = "crit-fail" | "fail" | "cost" | "success" | "crit-success"

/** The Heart outcome band for the highest kept d10 (mirrors getResult in roll_utils). */
export const getRollOutcome = (value: number): RollOutcome => {
    if (value === 1) return "crit-fail"
    if (value <= 5) return "fail"
    if (value <= 7) return "cost"
    if (value <= 9) return "success"
    return "crit-success"
}
