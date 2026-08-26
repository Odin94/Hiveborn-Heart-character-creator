import { PostHog } from "posthog-node"
import { env } from "../config/env.js"

let client: PostHog | undefined

function getClient() {
    if (!env.PUBLIC_POSTHOG_KEY) return undefined
    client ??= new PostHog(env.PUBLIC_POSTHOG_KEY, { host: env.PUBLIC_POSTHOG_HOST, flushAt: 1, flushInterval: 10_000 })
    return client
}

export function trackEvent(event: string, distinctId: string, properties: Record<string, unknown> = {}) {
    getClient()?.capture({ distinctId, event, properties: { ...properties, environment: env.NODE_ENV, app: "hiveborn" } })
}

export async function shutdownTracking() {
    await client?.shutdown()
}
