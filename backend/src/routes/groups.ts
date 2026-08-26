import type { FastifyInstance } from "fastify"
import { randomInt } from "node:crypto"
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import { db, schema } from "../db/index.js"
import { authenticateUser } from "../middleware/auth.js"
import { trackEvent } from "../utils/tracker.js"
import { broadcastGroupEvent, broadcastUserCharacterChange } from "../websocket/liveGroups.js"

const groupInput = z.object({ name: z.string().trim().min(2).max(80) })
const idInput = z.object({ id: z.string().min(1) })
const inviteInput = z.object({ nickname: z.string().trim().min(3).max(30) })
const rollInput = z.object({
    label: z.string().trim().min(1).max(160),
    dice: z.string().trim().min(1).max(80),
    result: z.string().trim().min(1).max(160),
    characterName: z.string().trim().min(1).max(120),
})
const falloutUpdateInput = z.object({ characterId: z.string().min(1), applyStressUpdate: z.boolean() })

async function assertMember(groupId: string, userId: string) {
    return db
        .select()
        .from(schema.groupMembers)
        .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
        .get()
}

async function groupOverview(groupId: string) {
    const group = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).get()
    if (!group) return undefined
    const members = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId))
    const userIds = members.map((member) => member.userId)
    const users = userIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, userIds)) : []
    const characters = userIds.length
        ? await db
              .select()
              .from(schema.characters)
              .where(and(inArray(schema.characters.userId, userIds), isNull(schema.characters.deletedAt)))
        : []
    const rolls = await db.select().from(schema.rollEvents).where(eq(schema.rollEvents.groupId, groupId)).orderBy(desc(schema.rollEvents.createdAt)).limit(30)
    return {
        id: group.id,
        name: group.name,
        ownerId: group.ownerId,
        createdAt: group.createdAt,
        members: members.map((member) => {
            const user = users.find((entry) => entry.id === member.userId)
            return {
                id: member.userId,
                nickname: user?.nickname ?? null,
                joinedAt: member.joinedAt,
                characters: characters
                    .filter((character) => character.userId === member.userId)
                    .map((character) => ({ id: character.id, name: character.name, data: JSON.parse(character.data), updatedAt: character.updatedAt })),
            }
        }),
        rolls: rolls.map((roll) => ({ ...roll })),
    }
}

export async function groupRoutes(fastify: FastifyInstance) {
    fastify.get("/play-groups", { preHandler: authenticateUser }, async (request) => {
        const memberships = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.userId, request.userId!))
        return { groups: (await Promise.all(memberships.map((member) => groupOverview(member.groupId)))).filter(Boolean) }
    })

    fastify.post("/play-groups", { preHandler: authenticateUser }, async (request, reply) => {
        const parsed = groupInput.safeParse(request.body)
        if (!parsed.success) return reply.code(400).send({ error: "A group needs a name" })
        const user = await db.select().from(schema.users).where(eq(schema.users.id, request.userId!)).get()
        if (!user?.nickname) return reply.code(422).send({ error: "Choose a nickname before creating a play group" })
        const id = nanoid()
        db.transaction((tx) => {
            tx.insert(schema.groups).values({ id, name: parsed.data.name, ownerId: request.userId! }).run()
            tx.insert(schema.groupMembers).values({ groupId: id, userId: request.userId! }).run()
        })
        trackEvent("play_group_created", request.userId!, { group_name_length: parsed.data.name.length })
        return groupOverview(id)
    })

    fastify.post("/play-groups/:id/invitations", { preHandler: authenticateUser }, async (request, reply) => {
        const params = idInput.safeParse(request.params)
        const parsed = inviteInput.safeParse(request.body)
        if (!params.success || !parsed.success) return reply.code(400).send({ error: "Invalid invitation" })
        if (!(await assertMember(params.data.id, request.userId!))) return reply.code(403).send({ error: "You are not in this play group" })
        const recipient = await db
            .select()
            .from(schema.users)
            .where(sql`lower(${schema.users.nickname}) = lower(${parsed.data.nickname})`)
            .get()
        if (!recipient) return reply.code(404).send({ error: "No player has that nickname" })
        try {
            await db.insert(schema.groupMembers).values({ groupId: params.data.id, userId: recipient.id })
        } catch {
            return reply.code(409).send({ error: "That player is already in the group" })
        }
        trackEvent("play_group_invitation_accepted", request.userId!)
        broadcastGroupEvent(params.data.id, { type: "group.members.updated" })
        return groupOverview(params.data.id)
    })

    fastify.post("/play-groups/:id/rolls", { preHandler: authenticateUser }, async (request, reply) => {
        const params = idInput.safeParse(request.params)
        const parsed = rollInput.safeParse(request.body)
        if (!params.success || !parsed.success) return reply.code(400).send({ error: "Invalid roll" })
        if (!(await assertMember(params.data.id, request.userId!))) return reply.code(403).send({ error: "You are not in this play group" })
        const [roll] = await db
            .insert(schema.rollEvents)
            .values({ id: nanoid(), groupId: params.data.id, userId: request.userId!, ...parsed.data })
            .returning()
        trackEvent("group_roll_shared", request.userId!, { dice: parsed.data.dice })
        broadcastGroupEvent(params.data.id, { type: "roll.shared", roll })
        return roll
    })

    fastify.post("/play-groups/:id/fallout-rolls", { preHandler: authenticateUser }, async (request, reply) => {
        const params = idInput.safeParse(request.params)
        const parsed = falloutUpdateInput.safeParse(request.body)
        if (!params.success || !parsed.success) return reply.code(400).send({ error: "Invalid fallout roll" })
        if (!(await assertMember(params.data.id, request.userId!))) return reply.code(403).send({ error: "You are not in this play group" })
        const character = await db
            .select()
            .from(schema.characters)
            .where(and(eq(schema.characters.id, parsed.data.characterId), isNull(schema.characters.deletedAt)))
            .get()
        if (!character || !(await assertMember(params.data.id, character.userId))) return reply.code(404).send({ error: "Character not found in this group" })
        const data = JSON.parse(character.data) as { stress?: Record<string, number>; lastStressResistance?: string }
        const totalStress = Object.values(data.stress ?? {}).reduce((total, value) => total + Number(value || 0), 0)
        // The server owns the random result so a GM cannot accidentally (or
        // deliberately) submit a chosen fallout outcome from a modified client.
        const roll = randomInt(1, 13)
        const fallout = roll < totalStress ? (roll >= 7 ? "major" : "minor") : null
        if (fallout && parsed.data.applyStressUpdate) {
            if (fallout === "major") for (const key of Object.keys(data.stress ?? {})) data.stress![key] = 0
            else if (data.lastStressResistance && data.stress) data.stress[data.lastStressResistance] = 0
            const [updatedCharacter] = await db
                .update(schema.characters)
                .set({ data: JSON.stringify(data), updatedAt: new Date(), version: character.version + 1 })
                .where(eq(schema.characters.id, character.id))
                .returning()
            await broadcastUserCharacterChange(character.userId, {
                character: { ...updatedCharacter!, data },
            })
        }
        const result = {
            characterId: character.id,
            totalStress,
            roll,
            fallout,
            stressUpdated: Boolean(fallout && parsed.data.applyStressUpdate),
            lastStressResistance: data.lastStressResistance ?? null,
        }
        broadcastGroupEvent(params.data.id, { type: "fallout.rolled", result })
        trackEvent("group_fallout_rolled", request.userId!, { fallout: fallout ?? "none", auto_updated: result.stressUpdated })
        return result
    })
}
