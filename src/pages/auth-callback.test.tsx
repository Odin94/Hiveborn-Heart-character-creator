import { act, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { AuthCallbackPage } from "./auth-callback"
import { clearStageConnection, parseStageConnection, saveStageConnection } from "@/lib/stageConnection"
const mocks = vi.hoisted(() => ({ refresh: vi.fn(async () => null), navigate: vi.fn(), callback: vi.fn(), setToken: vi.fn() }))
// useAuth returns a new object as loading/user changes, with stable actions.
vi.mock("@/App", () => ({ useAppAuth: () => ({ refresh: mocks.refresh, loading: false }) }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }))
vi.mock("@/lib/api", () => ({ api: { callback: mocks.callback }, tokenStorage: { set: mocks.setToken } }))
it("exchanges the one-time code once across auth context updates", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    history.replaceState(null, "", "/auth/callback?code=disposable-code")
    let resolve!: (value: { token: string }) => void
    mocks.callback.mockReturnValue(
        new Promise((done) => {
            resolve = done
        }),
    )
    const container = document.createElement("div")
    const root = createRoot(container)
    try {
        await act(() => root.render(<AuthCallbackPage />))
        await act(() => root.render(<AuthCallbackPage />))
        expect(mocks.callback).toHaveBeenCalledExactlyOnceWith("disposable-code")
        await act(async () => resolve({ token: "disposable-token" }))
        expect(mocks.setToken).toHaveBeenCalledExactlyOnceWith("disposable-token")
        expect(mocks.refresh).toHaveBeenCalledOnce()
        expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/", replace: true })
    } finally {
        await act(() => root.unmount())
        history.replaceState(null, "", "/")
    }
})

it("returns from WorkOS to an unexpired Stage handoff, exchanging the code once in StrictMode", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    for (const expired of [false, true]) {
        vi.clearAllMocks()
        const pending = parseStageConnection(
            new URLSearchParams({ redirect_uri: "http://127.0.0.1:43822/hiveborn/callback", state: "a".repeat(64) }).toString(),
        )!
        saveStageConnection({ ...pending, expiresAt: expired ? Date.now() - 1 : pending.expiresAt })
        history.replaceState(null, "", "/auth/callback?code=stage-code")
        mocks.callback.mockResolvedValue({ token: "disposable-token" })
        const root = createRoot(document.createElement("div"))
        try {
            await act(() =>
                root.render(
                    <StrictMode>
                        <AuthCallbackPage />
                    </StrictMode>,
                ),
            )
            expect(mocks.callback).toHaveBeenCalledExactlyOnceWith("stage-code")
            expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({ to: expired ? "/" : "/stage-connect", replace: true })
        } finally {
            await act(() => root.unmount())
            clearStageConnection()
            history.replaceState(null, "", "/")
        }
    }
})
