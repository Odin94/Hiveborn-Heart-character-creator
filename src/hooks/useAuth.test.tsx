import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { api, tokenStorage, type ApiRequestError } from "@/lib/api"
import { useAuth } from "./useAuth"
vi.mock("@/lib/api", () => ({
    AUTH_TOKEN_STORAGE_KEY: "token",
    api: { me: vi.fn(), logout: vi.fn(), devLogin: vi.fn() },
    tokenStorage: {
        get: () => localStorage.getItem("token"),
        getGeneration: () => localStorage.getItem("token"),
        set: (token: string) => localStorage.setItem("token", token),
        remove: () => localStorage.removeItem("token"),
    },
}))
vi.mock("posthog-js", () => ({ default: { identify: vi.fn(), reset: vi.fn() } }))
let root: Root, container: HTMLDivElement, auth: ReturnType<typeof useAuth>
const user = { id: "owner", email: "owner@example.com", firstName: null, lastName: null, nickname: null }
function Auth() {
    auth = useAuth()
    return <span>{auth.loading ? "pending" : (auth.user?.id ?? "signed out")}</span>
}
beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    localStorage.clear()
    tokenStorage.set("session")
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
it.each([new Error("Offline"), Object.assign(new Error("Unavailable"), { status: 503 })])(
    "keeps initial authentication pending and retries after a temporary failure",
    async (error) => {
        vi.mocked(api.me).mockRejectedValueOnce(error).mockResolvedValueOnce(user)
        await act(async () => root.render(<Auth />))
        expect(tokenStorage.get()).toBe("session")
        expect(container.textContent).toBe("pending")
        await act(async () => vi.advanceTimersByTimeAsync(3000))
        expect(container.textContent).toBe(user.id)
        expect(tokenStorage.get()).toBe("session")
    },
)
it("only a definitive 401 invalidates credentials", async () => {
    vi.mocked(api.me).mockRejectedValue(Object.assign(new Error("Invalid"), { status: 401 }) as ApiRequestError)
    await act(async () => root.render(<Auth />))
    expect(tokenStorage.get()).toBe(null)
    expect(container.textContent).toBe("signed out")
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(api.me).toHaveBeenCalledTimes(1)
})
it("retains the confirmed user during an outage and retries on reconnect", async () => {
    vi.mocked(api.me).mockResolvedValueOnce(user).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(user)
    await act(async () => root.render(<Auth />))
    await act(async () => auth.refresh())
    expect(auth.user).toEqual(user)
    expect(auth.loading).toBe(false)
    await act(async () => window.dispatchEvent(new Event("online")))
    expect(api.me).toHaveBeenCalledTimes(3)
})
it("does not apply a refresh response after logout", async () => {
    let resolve!: (value: typeof user) => void
    vi.mocked(api.me).mockReturnValue(
        new Promise((done) => {
            resolve = done
        }),
    )
    vi.mocked(api.logout).mockResolvedValue({ success: true })
    await act(async () => root.render(<Auth />))
    await act(async () => auth.logout())
    await act(async () => resolve(user))
    expect(tokenStorage.get()).toBe(null)
    expect(auth.user).toBe(null)
})

it("rejects a stale successful /me after the stored token changes, even before the storage event arrives", async () => {
    let resolve!: (value: typeof user) => void
    vi.mocked(api.me).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done
        }),
    )
    await act(async () => root.render(<Auth />))
    tokenStorage.set("another-account")
    await act(async () => resolve(user))
    expect(auth.user).toBe(null)
    expect(auth.loading).toBe(true)
})
it("refreshes the new account after another tab changes authentication and ignores the old response", async () => {
    let resolve!: (value: typeof user) => void
    const other = { ...user, id: "other-account", email: "other@example.com" }
    vi.mocked(api.me)
        .mockReturnValueOnce(
            new Promise((done) => {
                resolve = done
            }),
        )
        .mockResolvedValueOnce(other)
    await act(async () => root.render(<Auth />))
    tokenStorage.set("another-account")
    await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: "token" })))
    await act(async () => resolve(user))
    expect(auth.user).toEqual(other)
    expect(auth.loading).toBe(false)
})
