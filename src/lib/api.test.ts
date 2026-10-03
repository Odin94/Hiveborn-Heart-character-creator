import { afterEach, expect, it, vi } from "vitest"
import { api, tokenStorage } from "./api"
afterEach(() => vi.unstubAllGlobals())
it("verified token rotation preserves the current session generation", async () => {
    localStorage.clear()
    tokenStorage.set("session-a")
    const generation = tokenStorage.getGeneration()
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ id: "a" }), { headers: { "Content-Type": "application/json", "X-New-Token": "rotated-a" } })),
    )
    await api.me()
    expect(tokenStorage.get()).toBe("rotated-a")
    expect(tokenStorage.getGeneration()).toBe(generation)
})
it("a late response cannot rotate a replaced session even if its token value returns to the original", async () => {
    localStorage.clear()
    tokenStorage.set("session-a")
    let resolve!: (value: Response) => void
    vi.stubGlobal(
        "fetch",
        vi.fn(
            () =>
                new Promise<Response>((done) => {
                    resolve = done
                }),
        ),
    )
    const pending = api.me()
    tokenStorage.set("session-b")
    tokenStorage.set("session-a")
    resolve(new Response(JSON.stringify({ id: "a" }), { headers: { "Content-Type": "application/json", "X-New-Token": "stale-rotated-a" } }))
    await pending
    expect(tokenStorage.get()).toBe("session-a")
})
