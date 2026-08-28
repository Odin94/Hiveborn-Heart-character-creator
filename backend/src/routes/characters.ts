import type { FastifyInstance } from "fastify"
import { and, eq, isNull } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import { characterDataSchema, type CharacterData } from "../characterData.js"
import { db, schema } from "../db/index.js"
import { authenticateUser } from "../middleware/auth.js"
import { trackEvent } from "../utils/tracker.js"
import { broadcastGroupEvent, broadcastUserCharacterChange } from "../websocket/liveGroups.js"
import { assignSoleCharacterToAllGroups } from "./groups.js"

const createCharacterInput = z.object({ data: characterDataSchema })
const characterUpdateInput = z.object({
    baseVersion: z.number().int().positive(),
    baseData: characterDataSchema,
    changes: characterDataSchema.partial().refine((changes) => Object.keys(changes).length > 0, "No character changes supplied"),
})
const characterId = z.object({ id: z.string().min(1) })

const mergeableObjectFields = ["skills", "domains", "protections", "stress"] as const satisfies ReadonlyArray<keyof CharacterData>

const isEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const isMergeableObjectField = (field: keyof CharacterData): field is (typeof mergeableObjectFields)[number] => mergeableObjectFields.includes(field as never)

const deserialize = (character: typeof schema.characters.$inferSelect): CharacterData => characterDataSchema.parse(JSON.parse(character.data))
const serialize = (character: typeof schema.characters.$inferSelect) => ({ ...character, data: deserialize(character) })

function mergeCharacter(base: CharacterData, current: CharacterData, changes: Partial<CharacterData>) {
    const merged = structuredClone(current)
    const conflicts: string[] = []

    for (const [field, localValue] of Object.entries(changes) as Array<[keyof CharacterData, CharacterData[keyof CharacterData]]>) {
        const baseValue = base[field]
        const currentValue = current[field]
        if (isEqual(currentValue, baseValue) || isEqual(currentValue, localValue)) {
            ;(merged as Record<string, unknown>)[field] = localValue
            continue
        }
        if (!isMergeableObjectField(field)) {
            conflicts.push(field)
            continue
        }

        const nextValue = { ...(currentValue as Record<string, unknown>) }
        for (const [key, localNestedValue] of Object.entries(localValue as Record<string, unknown>)) {
            const baseNestedValue = (baseValue as Record<string, unknown>)[key]
            const currentNestedValue = (currentValue as Record<string, unknown>)[key]
            if (isEqual(localNestedValue, baseNestedValue)) continue
            if (isEqual(currentNestedValue, baseNestedValue) || isEqual(currentNestedValue, localNestedValue)) nextValue[key] = localNestedValue
            else conflicts.push(`${field}.${key}`)
        }
        ;(merged as Record<string, unknown>)[field] = nextValue
    }

    return { data: characterDataSchema.parse(merged), conflicts }
}

export async function characterRoutes(fastify: FastifyInstance) {
    fastify.get("/characters", { preHandler: authenticateUser }, async (request) => {
        const records = await db
            .select()
            .from(schema.characters)
            .where(and(eq(schema.characters.userId, request.userId!), isNull(schema.characters.deletedAt)))
            .orderBy(schema.characters.createdAt)
        return { characters: records.map(serialize) }
    })

    fastify.post("/characters", { preHandler: authenticateUser }, async (request, reply) => {
        const parsed = createCharacterInput.safeParse(request.body)
        if (!parsed.success) return reply.code(400).send({ error: "Invalid character", details: parsed.error.flatten() })
        const [character] = await db
            .insert(schema.characters)
            .values({
                id: nanoid(),
                userId: request.userId!,
                name: parsed.data.data.name.trim() || "Unnamed hiveborn",
                data: JSON.stringify(parsed.data.data),
                version: 1,
            })
            .returning()
        trackEvent("character_created", request.userId!)
        const serialized = serialize(character!)
        const automaticallyAssignedGroupIds = await assignSoleCharacterToAllGroups(request.userId!)
        await broadcastUserCharacterChange(request.userId!, { character: serialized })
        for (const groupId of automaticallyAssignedGroupIds) broadcastGroupEvent(groupId, { type: "group.members.updated" })
        return serialized
    })

    fastify.put("/characters/:id", { preHandler: authenticateUser }, async (request, reply) => {
        const params = characterId.safeParse(request.params)
        const parsed = characterUpdateInput.safeParse(request.body)
        if (!params.success || !parsed.success)
            return reply.code(400).send({ error: "Invalid character update", details: parsed.success ? undefined : parsed.error.flatten() })

        // Compare-and-swap makes updates safe even if two requests read the same
        // version. On a version mismatch we three-way merge disjoint fields.
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const current = await db
                .select()
                .from(schema.characters)
                .where(and(eq(schema.characters.id, params.data.id), eq(schema.characters.userId, request.userId!), isNull(schema.characters.deletedAt)))
                .get()
            if (!current) return reply.code(404).send({ error: "Character not found" })

            const currentData = deserialize(current)
            const { data, conflicts } = mergeCharacter(parsed.data.baseData, currentData, parsed.data.changes)
            if (current.version !== parsed.data.baseVersion && conflicts.length) {
                return reply.code(409).send({ error: "Character has conflicting changes", character: serialize(current), conflicts })
            }

            const [character] = await db
                .update(schema.characters)
                .set({ data: JSON.stringify(data), name: data.name.trim() || "Unnamed hiveborn", version: current.version + 1, updatedAt: new Date() })
                .where(and(eq(schema.characters.id, current.id), eq(schema.characters.version, current.version)))
                .returning()
            if (!character) continue

            const serialized = serialize(character)
            await broadcastUserCharacterChange(request.userId!, { character: serialized })
            return serialized
        }

        return reply.code(409).send({ error: "Character changed while saving; please retry" })
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
        await broadcastUserCharacterChange(request.userId!, { characterId: character.id, deleted: true })
        await db.delete(schema.groupCharacterAssignments).where(eq(schema.groupCharacterAssignments.characterId, character.id))
        const automaticallyAssignedGroupIds = await assignSoleCharacterToAllGroups(request.userId!)
        for (const groupId of automaticallyAssignedGroupIds) broadcastGroupEvent(groupId, { type: "group.members.updated" })
        return { success: true }
    })
}
