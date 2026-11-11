import "./App.css"
import { createContext, useContext, useEffect } from "react"
import { Outlet, useRouterState } from "@tanstack/react-router"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppBar } from "@/components/app-bar"
import { QuickNavigator } from "@/components/quick-navigator"
import { useUserUuid } from "@/lib/analytics"
import { usePostHog } from "posthog-js/react"
import { useAuth } from "@/hooks/useAuth"
import { useCloudCharacterSync } from "@/hooks/useCloudCharacterSync"

type AuthState = ReturnType<typeof useAuth>
const AuthContext = createContext<AuthState | null>(null)

export const useAppAuth = () => {
    const auth = useContext(AuthContext)
    if (!auth) throw new Error("useAppAuth must be used inside the app route")
    return auth
}

function App() {
    const posthog = usePostHog()
    const { userUuid, setUserUuid } = useUserUuid()
    const auth = useAuth()
    // Focused hand-off flows (OAuth callback, Stage connect) render without the app chrome.
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    const showChrome = !pathname.startsWith("/auth/") && pathname !== "/stage-connect"
    useEffect(() => {
        if (!userUuid) {
            setUserUuid()
        }
    }, [userUuid, setUserUuid])

    useCloudCharacterSync(auth.user?.id, auth.loading)

    useEffect(() => {
        // Keep authenticated account activity on the WorkOS user identity.
        // Previously this effect ran after useAuth identified the account and
        // replaced it with an anonymous browser UUID.
        const distinctId = auth.user?.id ?? userUuid
        if (!distinctId) return
        posthog.identify(distinctId)
        posthog.capture("Pageview: Hiveborn", { userUuid, authenticated: Boolean(auth.user) })
    }, [auth.user, posthog, userUuid])

    return (
        <AuthContext.Provider value={auth}>
            <TooltipProvider>
                <Toaster closeButton />
                {showChrome ? <AppBar auth={auth} /> : null}
                <QuickNavigator auth={auth} enabled={showChrome} />
                <Outlet />
            </TooltipProvider>
        </AuthContext.Provider>
    )
}

export default App
