/** True when the OS asks for reduced motion; dice then land (and results show) without the tumble. */
export const prefersReducedMotion = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** How long a roll tumbles before its result is revealed. */
export const getRollRevealMs = (animationMs: number) => (prefersReducedMotion() ? 0 : animationMs)
