import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { AuthCallbackPage } from "./auth-callback"
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
