import assert from "node:assert/strict"
import { test } from "node:test"
import { createRequire } from "node:module"
import { once } from "node:events"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

process.env.NODE_ENV = "test"
process.env.DATABASE_URL = ":memory:"
process.env.WORKOS_API_KEY = ""
process.env.PUBLIC_POSTHOG_KEY = ""
const { default: Fastify } = await import("fastify")
const { db, schema } = await import("../src/db/index.js")
const { registerLiveGroupRoutes, broadcastUserEvent, broadcastGroupEvent, onlineGroupMemberIds } = await import("../src/websocket/liveGroups.js")
const require = createRequire(import.meta.url)
const WS = createRequire(require.resolve("@fastify/websocket"))("ws")
migrate(db, { migrationsFolder: "./src/db/migrations" })
db.insert(schema.users).values({ id: "local-hivekeeper", email: "local@test.local" }).run()
db.insert(schema.groups).values({ id: "group", name: "Group", ownerId: "local-hivekeeper" }).run()
db.insert(schema.groupMembers).values({ groupId: "group", userId: "local-hivekeeper" }).run()

test("character and group sockets authenticate through frames and never publish before authentication", async () => {
    const app = Fastify()
    await registerLiveGroupRoutes(app)
    await app.listen({ port: 0, host: "127.0.0.1" })
    const address = app.server.address() as { port: number }
    try {
        for (const path of ["/characters/live", "/play-groups/group/live"]) {
            const socket = new WS(`ws://127.0.0.1:${address.port}${path}`, { origin: "http://localhost:5313" })
            await once(socket, "open")
            const messages: string[] = []
            socket.on("message", (data: { toString(): string }) => messages.push(data.toString()))
            broadcastUserEvent("local-hivekeeper", { type: "secret" })
            broadcastGroupEvent("group", { type: "secret" })
            assert.deepEqual(messages, [])
            assert.deepEqual(onlineGroupMemberIds("group"), [])
            const authenticated = once(socket, "message")
            socket.send(JSON.stringify({ type: "auth", token: "hiveborn-local-dev-user" }))
            assert.equal(JSON.parse(String((await authenticated)[0])).type, "authenticated")
            const update = once(socket, "message")
            if (path.startsWith("/characters")) broadcastUserEvent("local-hivekeeper", { type: "updated" })
            else broadcastGroupEvent("group", { type: "updated" })
            assert.equal(JSON.parse(String((await update)[0])).type, "updated")
            socket.close()
            await once(socket, "close")
        }
        const denied = new WS(`ws://127.0.0.1:${address.port}/characters/live?token=hiveborn-local-dev-user`, { origin: "http://localhost:5313" })
        await once(denied, "open")
        denied.send(JSON.stringify({ type: "invalid", token: "hiveborn-local-dev-user" }))
        const closed = await once(denied, "close")
        assert.equal(closed[0], 1008)
    } finally {
        await app.close()
    }
})
