export type DieSize = 4 | 6 | 8 | 10 | 12

export type DieRoll = {
    id: number
    value: number
    sides: DieSize
    removed: boolean
}

export type RollResult = {
    value: number
    title: string
    description: string
}

export type RollerTab = "skill-domain" | "free-roll"

export type DieProps = {
    die: DieRoll
    rolling: boolean
    index: number
    /** The die whose face decides the outcome; it gets a heart-light pool under it once settled. */
    featured?: boolean
}
