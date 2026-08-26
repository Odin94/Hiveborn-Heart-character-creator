import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { PostHogProvider } from "posthog-js/react"
import posthog from "posthog-js"
import { RouterProvider } from "@tanstack/react-router"
import { router } from "./router"

if (import.meta.env.VITE_PUBLIC_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
        api_host: "https://info.odin-matthias.com",
        ui_host: "https://eu.posthog.com",
        capture_exceptions: true,
        debug: import.meta.env.MODE === "development",
        cookieless_mode: "on_reject",
    })
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <PostHogProvider client={posthog}>
            <RouterProvider router={router} />
        </PostHogProvider>
    </StrictMode>,
)
