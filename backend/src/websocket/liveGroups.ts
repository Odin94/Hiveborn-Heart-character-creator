import type { FastifyInstance } from "fastify"
import websocket from "@fastify/websocket"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/index.js"
import { authenticateToken } from "../middleware/auth.js"
import { isAllowedFrontendOrigin, isLocalhostHost, isLoopbackAddress } from "../config/env.js"

const subscribers = new Map<string, Set<WebSocket>>()
const userSubscribers = new Map<string, Set<WebSocket>>()

type CharacterChange = {
    character?: Record<string, unknown> & { id?: string }
    characterId?: string
    deleted?: boolean
}

export function broadcastGroupEvent(groupId: string, event: Record<string, unknown>) {
    const groupSubscribers = subscribers.get(groupId)
    if (!groupSubscribers) return
    const payload = JSON.stringify(event)
    for (const socket of groupSubscribers) if (socket.readyState === socket.OPEN) socket.send(payload)
}

export function broadcastUserEvent(userId: string, event: Record<string, unknown>) {
    const sockets = userSubscribers.get(userId)
    if (!sockets) return
    const payload = JSON.stringify(event)
    for (const socket of sockets) if (socket.readyState === socket.OPEN) socket.send(payload)
}

export async function broadcastUserCharacterChange(userId: string, change: CharacterChange = {}) {
    broadcastUserEvent(userId, {
        type: change.deleted ? "character.deleted" : "character.updated",
        userId,
        ...change,
    })
    const characterId = change.deleted ? change.characterId : change.character?.id
    const assignments = characterId
        ? await db
              .select({ groupId: schema.groupCharacterAssignments.groupId })
              .from(schema.groupCharacterAssignments)
              .where(eq(schema.groupCharacterAssignments.characterId, characterId))
        : await db.select({ groupId: schema.groupMembers.groupId }).from(schema.groupMembers).where(eq(schema.groupMembers.userId, userId))
    for (const assignment of assignments) {
        broadcastGroupEvent(assignment.groupId, {
            type: change.deleted ? "character.deleted" : "character.updated",
            userId,
            ...change,
        })
    }
}

export async function registerLiveGroupRoutes(fastify: FastifyInstance) {
    await fastify.register(websocket)
    fastify.get("/characters/live", { websocket: true }, async (socket, request) => {
        const token = (request.query as { token?: string }).token
        if (!token) return socket.close(1008, "Missing token")
        if (!isAllowedFrontendOrigin(request.headers.origin)) return socket.close(1008, "Untrusted origin")
        const user = await authenticateToken(token, isLocalhostHost(request.headers.host) && isLoopbackAddress(request.raw.socket.remoteAddress))
        if (!user) return socket.close(1008, "Unauthorized")
        const sockets = userSubscribers.get(user.id) ?? new Set<WebSocket>()
        sockets.add(socket)
        userSubscribers.set(user.id, sockets)
        socket.on("close", () => {
            sockets.delete(socket)
            if (!sockets.size) userSubscribers.delete(user.id)
        })
    })
    fastify.get("/play-groups/:id/live", { websocket: true }, async (socket, request) => {
        const params = request.params as { id?: string }
        const token = (request.query as { token?: string }).token
        if (!params.id || !token) return socket.close(1008, "Missing group or token")
        if (!isAllowedFrontendOrigin(request.headers.origin)) return socket.close(1008, "Untrusted origin")
        const user = await authenticateToken(token, isLocalhostHost(request.headers.host) && isLoopbackAddress(request.raw.socket.remoteAddress))
        if (!user) return socket.close(1008, "Unauthorized")
        const membership = await db
            .select()
            .from(schema.groupMembers)
            .where(and(eq(schema.groupMembers.groupId, params.id), eq(schema.groupMembers.userId, user.id)))
            .get()
        if (!membership) return socket.close(1008, "Not a group member")
        const groupSubscribers = subscribers.get(params.id) ?? new Set<WebSocket>()
        groupSubscribers.add(socket)
        subscribers.set(params.id, groupSubscribers)
        socket.on("close", () => {
            groupSubscribers.delete(socket)
            if (!groupSubscribers.size) subscribers.delete(params.id!)
        })
    })
}
