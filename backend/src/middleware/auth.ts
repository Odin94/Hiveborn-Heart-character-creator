import type { FastifyReply, FastifyRequest } from "fastify"
import { env, hasWorkosConfiguration } from "../config/env.js"
import { workos } from "../config/workos.js"

declare module "fastify" {
    interface FastifyRequest {
        userId?: string
        user?: { id: string; email: string; firstName: string | null; lastName: string | null }
    }
}

export async function authenticateUser(request: FastifyRequest, reply: FastifyReply) {
    const token = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : undefined
    if (!token) return reply.code(401).send({ error: "Unauthorized", message: "No session token provided" })
    if (env.NODE_ENV !== "production" && token === "hiveborn-local-dev-user") {
        request.user = { id: "local-hivekeeper", email: "local@hiveborn.test", firstName: "Local", lastName: "Hivekeeper" }
        request.userId = request.user.id
        return
    }
    if (!hasWorkosConfiguration || !workos) return reply.code(503).send({ error: "Authentication unavailable", message: "WorkOS is not configured" })
    try {
        const session = workos.userManagement.loadSealedSession({ sessionData: token, cookiePassword: env.WORKOS_COOKIE_PASSWORD! })
        const authenticated = await session.authenticate()
        if (authenticated.authenticated && "user" in authenticated) {
            request.user = authenticated.user
            request.userId = authenticated.user.id
            return
        }
        const refreshed = await session.refresh()
        if (refreshed.authenticated && "user" in refreshed) {
            request.user = refreshed.user
            request.userId = refreshed.user.id
            if ("sealedSession" in refreshed && refreshed.sealedSession) reply.header("X-New-Token", refreshed.sealedSession)
            return
        }
    } catch {
        // Return the generic unauthorized response below so session details stay private.
    }
    return reply.code(401).send({ error: "Unauthorized", message: "Session is invalid" })
}

export async function authenticateToken(token: string) {
    if (env.NODE_ENV !== "production" && token === "hiveborn-local-dev-user") {
        return { id: "local-hivekeeper", email: "local@hiveborn.test", firstName: "Local", lastName: "Hivekeeper" }
    }
    if (!hasWorkosConfiguration || !workos) {
        return undefined
    }
    try {
        const session = workos.userManagement.loadSealedSession({ sessionData: token, cookiePassword: env.WORKOS_COOKIE_PASSWORD! })
        const authenticated = await session.authenticate()
        if (authenticated.authenticated && "user" in authenticated) return authenticated.user
        const refreshed = await session.refresh()
        if (refreshed.authenticated && "user" in refreshed) return refreshed.user
        return undefined
    } catch {
        return undefined
    }
}
