import { createRootRoute, createRoute, createRouter, useParams } from "@tanstack/react-router"
import App, { AuthCallbackPage, CharacterSheetPage, PlayModePage } from "./App"

const rootRoute = createRootRoute({ component: App })

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: CharacterSheetPage,
})

const authCallbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth/callback",
    component: AuthCallbackPage,
})

const playRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/play",
    component: () => <PlayModePage />,
})

const playGroupRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/play/$groupId",
    component: PlayGroupRoute,
})

function PlayGroupRoute() {
    const { groupId } = useParams({ from: "/play/$groupId" })
    return <PlayModePage groupId={groupId} />
}

const routeTree = rootRoute.addChildren([indexRoute, authCallbackRoute, playRoute, playGroupRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router
    }
}
