import type { FastifyInstance } from "fastify"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { env, hasWorkosConfiguration, isLocalhostHost, isLoopbackAddress } from "../config/env.js"
import { workos } from "../config/workos.js"
import { db, schema } from "../db/index.js"
import { authenticateUser } from "../middleware/auth.js"
import { trackEvent } from "../utils/tracker.js"

const nicknameSchema = z.object({
    nickname: z
        .string()
        .trim()
        .min(3)
        .max(30)
        .regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores"),
})

function publicUser(user: { id: string; email: string; firstName: string | null; lastName: string | null }, nickname: string | null) {
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, nickname }
}

export async function authRoutes(fastify: FastifyInstance) {
    fastify.post("/auth/dev-login", async (request, reply) => {
        if (env.NODE_ENV === "production" || !isLocalhostHost(request.headers.host) || !isLoopbackAddress(request.raw.socket.remoteAddress))
            return reply.code(404).send({ error: "Not found" })
        const existing = await db.select().from(schema.users).where(eq(schema.users.id, "local-hivekeeper")).get()
        if (!existing)
            await db
                .insert(schema.users)
                .values({ id: "local-hivekeeper", email: "local@hiveborn.test", firstName: "Local", lastName: "Hivekeeper", nickname: "LocalHivekeeper" })
        const user = await db.select().from(schema.users).where(eq(schema.users.id, "local-hivekeeper")).get()
        return {
            success: true,
            token: "hiveborn-local-dev-user",
            user: {
                id: "local-hivekeeper",
                email: "local@hiveborn.test",
                firstName: "Local",
                lastName: "Hivekeeper",
                nickname: user?.nickname ?? "LocalHivekeeper",
            },
        }
    })

    fastify.get("/auth/login", async (_request, reply) => {
        if (!hasWorkosConfiguration || !workos) return reply.code(503).send({ error: "Authentication unavailable", message: "WorkOS is not configured" })
        return reply.redirect(
            workos.userManagement.getAuthorizationUrl({
                provider: "authkit",
                clientId: env.WORKOS_CLIENT_ID!,
                redirectUri: `${env.FRONTEND_URL}/auth/callback`,
            }),
        )
    })

    fastify.get("/auth/callback", async (request, reply) => {
        if (!hasWorkosConfiguration || !workos) return reply.code(503).send({ error: "Authentication unavailable" })
        const parsed = z.object({ code: z.string().min(1) }).safeParse(request.query)
        if (!parsed.success) return reply.code(400).send({ error: "Invalid callback" })
        const result = await workos.userManagement.authenticateWithCode({
            code: parsed.data.code,
            clientId: env.WORKOS_CLIENT_ID!,
            session: { sealSession: true, cookiePassword: env.WORKOS_COOKIE_PASSWORD! },
        })
        if (!result.user || !result.sealedSession) return reply.code(401).send({ error: "Authentication failed" })
        const existing = await db.select().from(schema.users).where(eq(schema.users.id, result.user.id)).get()
        if (existing)
            await db
                .update(schema.users)
                .set({ email: result.user.email, firstName: result.user.firstName, lastName: result.user.lastName, updatedAt: new Date() })
                .where(eq(schema.users.id, result.user.id))
        else {
            await db
                .insert(schema.users)
                .values({ id: result.user.id, email: result.user.email, firstName: result.user.firstName, lastName: result.user.lastName })
            trackEvent("account_created", result.user.id)
        }
        const user = await db.select().from(schema.users).where(eq(schema.users.id, result.user.id)).get()
        trackEvent("auth_callback_success", result.user.id)
        return { success: true, token: result.sealedSession, user: publicUser(result.user, user?.nickname ?? null) }
    })

    fastify.get("/auth/me", { preHandler: authenticateUser }, async (request) => {
        const user = await db.select().from(schema.users).where(eq(schema.users.id, request.userId!)).get()
        return publicUser(request.user!, user?.nickname ?? null)
    })

    fastify.put("/auth/me", { preHandler: authenticateUser }, async (request, reply) => {
        const parsed = nicknameSchema.safeParse(request.body)
        if (!parsed.success) return reply.code(400).send({ error: "Invalid nickname", details: parsed.error.flatten() })
        try {
            const [updated] = await db
                .update(schema.users)
                .set({ nickname: parsed.data.nickname, updatedAt: new Date() })
                .where(eq(schema.users.id, request.userId!))
                .returning()
            trackEvent("nickname_updated", request.userId!)
            return publicUser(request.user!, updated!.nickname)
        } catch (error) {
            if (String(error).includes("users_nickname_unique")) return reply.code(409).send({ error: "Nickname already taken" })
            throw error
        }
    })

    fastify.post("/auth/logout", { preHandler: authenticateUser }, async () => ({ success: true }))
}
