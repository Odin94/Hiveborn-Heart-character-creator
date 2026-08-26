import type { FastifyInstance } from "fastify"
import { and, eq, isNull } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import { db, schema } from "../db/index.js"
import { authenticateUser } from "../middleware/auth.js"
import { trackEvent } from "../utils/tracker.js"
import { broadcastUserCharacterChange } from "../websocket/liveGroups.js"

const characterInput = z.object({ name: z.string().trim().max(120), data: z.record(z.string(), z.unknown()), version: z.number().int().positive().optional() })
const characterId = z.object({ id: z.string().min(1) })

const serialize = (character: typeof schema.characters.$inferSelect) => ({ ...character, data: JSON.parse(character.data) })

export async function characterRoutes(fastify: FastifyInstance) {
    fastify.get("/characters", { preHandler: authenticateUser }, async (request) => {
        const records = await db
            .select()
            .from(schema.characters)
            .where(and(eq(schema.characters.userId, request.userId!), isNull(schema.characters.deletedAt)))
        return { characters: records.map(serialize) }
    })

    fastify.post("/characters", { preHandler: authenticateUser }, async (request, reply) => {
        const parsed = characterInput.safeParse(request.body)
        if (!parsed.success) return reply.code(400).send({ error: "Invalid character", details: parsed.error.flatten() })
        const [character] = await db
            .insert(schema.characters)
            .values({
                id: nanoid(),
                userId: request.userId!,
                name: parsed.data.name || "Unnamed hiveborn",
                data: JSON.stringify(parsed.data.data),
                version: parsed.data.version ?? 1,
            })
            .returning()
        trackEvent("character_created", request.userId!)
        await broadcastUserCharacterChange(request.userId!)
        return serialize(character!)
    })

    fastify.put("/characters/:id", { preHandler: authenticateUser }, async (request, reply) => {
        const params = characterId.safeParse(request.params)
        const parsed = characterInput.partial().safeParse(request.body)
        if (!params.success || !parsed.success) return reply.code(400).send({ error: "Invalid character update" })
        const current = await db
            .select()
            .from(schema.characters)
            .where(and(eq(schema.characters.id, params.data.id), eq(schema.characters.userId, request.userId!), isNull(schema.characters.deletedAt)))
            .get()
        if (!current) return reply.code(404).send({ error: "Character not found" })
        const [character] = await db
            .update(schema.characters)
            .set({
                ...(parsed.data.name === undefined ? {} : { name: parsed.data.name || "Unnamed hiveborn" }),
                ...(parsed.data.data === undefined ? {} : { data: JSON.stringify(parsed.data.data) }),
                version: (parsed.data.version ?? current.version) + 1,
                updatedAt: new Date(),
            })
            .where(eq(schema.characters.id, current.id))
            .returning()
        await broadcastUserCharacterChange(request.userId!)
        return serialize(character!)
    })

    fastify.delete("/characters/:id", { preHandler: authenticateUser }, async (request, reply) => {
        const params = characterId.safeParse(request.params)
        if (!params.success) return reply.code(400).send({ error: "Invalid character id" })
        const [character] = await db
            .update(schema.characters)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(schema.characters.id, params.data.id), eq(schema.characters.userId, request.userId!)))
            .returning()
        if (!character) return reply.code(404).send({ error: "Character not found" })
        await broadcastUserCharacterChange(request.userId!)
        return { success: true }
    })
}
