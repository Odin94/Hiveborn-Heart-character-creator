import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router"
import App from "./App"

const rootRoute = createRootRoute({ component: App })

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: lazyRouteComponent(() => import("./pages/character-sheet"), "CharacterSheetPage"),
})

const authCallbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth/callback",
    component: lazyRouteComponent(() => import("./pages/auth-callback"), "AuthCallbackPage"),
})

const playRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/play",
    component: lazyRouteComponent(() => import("./pages/play-mode"), "PlayModePage"),
})

const playGroupRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/play/$groupId",
    component: lazyRouteComponent(() => import("./pages/play-mode"), "PlayGroupPage"),
})

const routeTree = rootRoute.addChildren([indexRoute, authCallbackRoute, playRoute, playGroupRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router
    }
}
