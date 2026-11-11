import { useState } from "react"

/**
 * Staggers a track's boxes when its value jumps (e.g. 2 → 7 fills 3, 4, 5, 6, 7
 * one after another; 7 → 2 drains them from the end). Returns the delay for box `i` (1-based).
 */
export const useFillCascade = (n: number, stepMs = 28) => {
    const [current, setCurrent] = useState(n)
    const [from, setFrom] = useState(n)

    if (n !== current) {
        setFrom(current)
        setCurrent(n)
    }

    return (i: number) => {
        if (n > from && i > from && i <= n) return (i - from - 1) * stepMs
        if (n < from && i > n && i <= from) return (from - i) * Math.round(stepMs * 0.7)
        return 0
    }
}
