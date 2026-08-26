import { config } from "dotenv"
import { z } from "zod"

config({ quiet: true })

const envSchema = z.object({
    WORKOS_API_KEY: z.string().optional(),
    WORKOS_CLIENT_ID: z.string().optional(),
    WORKOS_COOKIE_PASSWORD: z.string().min(32).optional(),
    PORT: z.coerce.number().default(3003),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    FRONTEND_URL: z.url().default("http://localhost:5173"),
    BACKEND_URL: z.url().default("http://localhost:3003"),
    DATABASE_URL: z.string().default("./data/hiveborn.sqlite"),
    PUBLIC_POSTHOG_KEY: z.string().optional(),
    PUBLIC_POSTHOG_HOST: z.url().default("https://eu.i.posthog.com"),
})

export const env = envSchema.parse(process.env)

export const hasWorkosConfiguration = Boolean(env.WORKOS_API_KEY && env.WORKOS_CLIENT_ID && env.WORKOS_COOKIE_PASSWORD)

/** A development-only login must never be usable through a public host. */
export function isLocalhostHost(host: string | undefined) {
    if (!host) return false
    try {
        const hostname = new URL(`http://${host}`).hostname.toLowerCase()
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
    } catch {
        return false
    }
}

/**
 * Browser WebSocket handshakes are not governed by CORS. Keep their origin
 * policy in one place so it matches the HTTP API's permitted frontend.
 */
export function isAllowedFrontendOrigin(origin: string | undefined) {
    if (!origin) return false
    try {
        const url = new URL(origin)
        return url.origin === new URL(env.FRONTEND_URL).origin || (env.NODE_ENV !== "production" && isLocalhostHost(url.host))
    } catch {
        return false
    }
}

/** `Host` can be forged, so pair it with the actual TCP peer for local login. */
export function isLoopbackAddress(address: string | undefined) {
    return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1"
}
