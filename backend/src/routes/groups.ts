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
const characterAssignmentInput = z.object({ characterId: z.string().min(1) })
const characterAssignmentParams = z.object({ id: z.string().min(1), characterId: z.string().min(1) })

const groupAdjectives = [
    "amber",
    "ancient",
    "black",
    "blue",
    "brass",
    "bright",
    "cinder",
    "crimson",
    "deep",
    "distant",
    "drifting",
    "golden",
    "hidden",
    "hollow",
    "iron",
    "lunar",
    "misty",
    "mossy",
    "quiet",
    "red",
    "secret",
    "silver",
    "smoky",
    "swift",
    "verdant",
    "violet",
    "wild",
]
const groupAnimals = [
    "badger",
    "beetle",
    "crow",
    "eel",
    "fox",
    "goat",
    "heron",
    "hound",
    "lynx",
    "moth",
    "newt",
    "otter",
    "owl",
    "raven",
    "serpent",
    "shark",
    "spider",
    "stoat",
    "toad",
    "viper",
    "walrus",
    "weasel",
    "whale",
    "wolf",
    "wren",
]
const groupActions = [
    "beckons",
    "burrows",
    "calls",
    "crawls",
    "dances",
    "drifts",
    "dreams",
    "follows",
    "gathers",
    "glows",
    "howls",
    "hunts",
    "keeps",
    "listens",
    "lurks",
    "marches",
    "roams",
    "runs",
    "sings",
    "sleeps",
    "sneaks",
    "soars",
    "stalks",
    "waits",
    "wanders",
]

const randomItem = <T>(items: T[]) => items[randomInt(items.length)]!
const readableGroupId = () => `${randomItem(groupAdjectives)}-${randomItem(groupAnimals)}-${randomItem(groupActions)}`

async function newGroupId() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const id = readableGroupId()
        const existing = await db.select({ id: schema.groups.id }).from(schema.groups).where(eq(schema.groups.id, id)).get()
        if (!existing) return id
    }
    throw new Error("Could not allocate a unique play group ID")
}

async function assertMember(groupId: string, userId: string) {
    return db
        .select()
        .from(schema.groupMembers)
        .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
        .get()
}

/** Assign a user's sole active character to the specified groups (or every group they belong to). */
async function assignOnlyCharacterToGroups(userId: string, groupIds?: string[]) {
    const characters = await db
        .select({ id: schema.characters.id })
        .from(schema.characters)
        .where(and(eq(schema.characters.userId, userId), isNull(schema.characters.deletedAt)))
    if (characters.length !== 1) return []
    const memberships = await db
        .select({ groupId: schema.groupMembers.groupId })
        .from(schema.groupMembers)
        .where(and(eq(schema.groupMembers.userId, userId), ...(groupIds?.length ? [inArray(schema.groupMembers.groupId, groupIds)] : [])))
    if (!memberships.length) return []
    const assignments = await db
        .insert(schema.groupCharacterAssignments)
        .values(memberships.map((membership) => ({ groupId: membership.groupId, characterId: characters[0]!.id })))
        .onConflictDoNothing()
        .returning({ groupId: schema.groupCharacterAssignments.groupId })
    return assignments.map((assignment) => assignment.groupId)
}

export async function assignSoleCharacterToAllGroups(userId: string) {
    return assignOnlyCharacterToGroups(userId)
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
    const assignments = await db.select().from(schema.groupCharacterAssignments).where(eq(schema.groupCharacterAssignments.groupId, groupId))
    const assignmentsByCharacterId = new Map(assignments.map((assignment) => [assignment.characterId, assignment]))
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
                    .filter((character) => character.userId === member.userId && assignmentsByCharacterId.has(character.id))
                    .map((character) => ({
                        id: character.id,
                        name: character.name,
                        data: JSON.parse(character.data),
                        updatedAt: character.updatedAt,
                    })),
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
        const id = await newGroupId()
        db.transaction((tx) => {
            tx.insert(schema.groups).values({ id, name: parsed.data.name, ownerId: request.userId! }).run()
            tx.insert(schema.groupMembers).values({ groupId: id, userId: request.userId! }).run()
        })
        await assignOnlyCharacterToGroups(request.userId!, [id])
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
        await assignOnlyCharacterToGroups(recipient.id, [params.data.id])
        trackEvent("play_group_invitation_accepted", request.userId!)
        broadcastGroupEvent(params.data.id, { type: "group.members.updated" })
        return groupOverview(params.data.id)
    })

    fastify.post("/play-groups/:id/characters", { preHandler: authenticateUser }, async (request, reply) => {
        const params = idInput.safeParse(request.params)
        const parsed = characterAssignmentInput.safeParse(request.body)
        if (!params.success || !parsed.success) return reply.code(400).send({ error: "Invalid character assignment" })
        if (!(await assertMember(params.data.id, request.userId!))) return reply.code(403).send({ error: "You are not in this play group" })
        const character = await db
            .select({ id: schema.characters.id })
            .from(schema.characters)
            .where(and(eq(schema.characters.id, parsed.data.characterId), eq(schema.characters.userId, request.userId!), isNull(schema.characters.deletedAt)))
            .get()
        if (!character) return reply.code(404).send({ error: "Character not found" })
        await db.insert(schema.groupCharacterAssignments).values({ groupId: params.data.id, characterId: character.id }).onConflictDoNothing()
        broadcastGroupEvent(params.data.id, { type: "group.members.updated" })
        return groupOverview(params.data.id)
    })

    fastify.delete("/play-groups/:id/characters/:characterId", { preHandler: authenticateUser }, async (request, reply) => {
        const params = characterAssignmentParams.safeParse(request.params)
        if (!params.success) return reply.code(400).send({ error: "Invalid character assignment" })
        if (!(await assertMember(params.data.id, request.userId!))) return reply.code(403).send({ error: "You are not in this play group" })
        const character = await db
            .select({ id: schema.characters.id })
            .from(schema.characters)
            .where(and(eq(schema.characters.id, params.data.characterId), eq(schema.characters.userId, request.userId!), isNull(schema.characters.deletedAt)))
            .get()
        if (!character) return reply.code(404).send({ error: "Character not found" })
        await db
            .delete(schema.groupCharacterAssignments)
            .where(and(eq(schema.groupCharacterAssignments.groupId, params.data.id), eq(schema.groupCharacterAssignments.characterId, character.id)))
        broadcastGroupEvent(params.data.id, { type: "group.members.updated" })
        return { success: true }
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
        const assignment = character
            ? await db
                  .select()
                  .from(schema.groupCharacterAssignments)
                  .where(and(eq(schema.groupCharacterAssignments.groupId, params.data.id), eq(schema.groupCharacterAssignments.characterId, character.id)))
                  .get()
            : undefined
        if (!character || !assignment) return reply.code(404).send({ error: "Character not found in this group" })
        const data = JSON.parse(character.data) as { stress?: Record<string, number>; lastStressResistance?: string }
        const totalStress = Object.values(data.stress ?? {}).reduce((total, value) => total + Number(value || 0), 0)
        // The server owns the random result so a GM cannot accidentally (or
        // deliberately) submit a chosen fallout outcome from a modified client.
        const roll = randomInt(1, 13)
        const fallout = roll < totalStress ? (roll >= 7 ? "major" : "minor") : null
        let stressUpdate: { type: "all" } | { type: "resistance"; resistance: string } | null = null
        if (fallout && parsed.data.applyStressUpdate) {
            if (fallout === "major" && data.stress) {
                for (const key of Object.keys(data.stress)) data.stress[key] = 0
                stressUpdate = { type: "all" }
            } else if (data.lastStressResistance && data.stress) {
                data.stress[data.lastStressResistance] = 0
                stressUpdate = { type: "resistance", resistance: data.lastStressResistance }
            }
        }
        if (stressUpdate) {
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
            stressUpdated: Boolean(stressUpdate),
            stressUpdate,
            lastStressResistance: data.lastStressResistance ?? null,
        }
        const outcome = fallout ? `${fallout[0].toUpperCase()}${fallout.slice(1)} fallout` : "No fallout"
        const updateSummary = stressUpdate?.type === "all" ? "set all stress to 0" : stressUpdate ? `set ${stressUpdate.resistance} stress to 0` : ""
        const [sharedRoll] = await db
            .insert(schema.rollEvents)
            .values({
                id: nanoid(),
                groupId: params.data.id,
                userId: request.userId!,
                characterName: character.name || "Unnamed hiveborn",
                label: "Fallout",
                dice: "d12",
                result: updateSummary ? `${outcome} — ${updateSummary}` : outcome,
            })
            .returning()
        broadcastGroupEvent(params.data.id, { type: "roll.shared", roll: sharedRoll })
        trackEvent("group_fallout_rolled", request.userId!, { fallout: fallout ?? "none", auto_updated: result.stressUpdated })
        return result
    })
}
