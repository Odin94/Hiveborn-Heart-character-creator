import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { eq } from "drizzle-orm"
import * as schema from "../src/db/schema.js"
import { saveNewCharacter } from "../src/db/characterPersistence.js"
import type { CharacterData } from "../src/characterData.js"

const data = (uuid?: string): CharacterData => ({
    ...(uuid ? { uuid } : {}),
    name: "Witch",
    characterClass: "",
    calling: "",
    activeBeats: "",
    equipment: "Lantern",
    resources: "",
    abilities: "",
    fallout: "",
    skills: Object.fromEntries(
        ["compel", "delve", "discern", "endure", "evade", "hunt", "kill", "mend", "sneak"].map((key) => [key, { hasSkill: false, knacks: "" }]),
    ) as CharacterData["skills"],
    domains: Object.fromEntries(
        ["cursed", "desolate", "haven", "occult", "religion", "technology", "warren", "wild"].map((key) => [key, { hasDomain: false, knacks: "" }]),
    ) as CharacterData["domains"],
    protections: { blood: 0, mind: 0, echo: 0, fortune: 0, supplies: 0 },
    stress: { blood: 0, mind: 0, echo: 0, fortune: 0, supplies: 0 },
    lastStressResistance: "blood",
})

function fixture() {
    const sqlite = new Database(":memory:")
    sqlite.pragma("foreign_keys = ON")
    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: "./src/db/migrations" })
    db.insert(schema.users)
        .values([
            { id: "a", email: "a@example.com" },
            { id: "b", email: "b@example.com" },
        ])
        .run()
    return { sqlite, db }
}

test("UUID creates retry idempotently; same-owner conflicts, other owners and deleted UUIDs produce new preserved copies", () => {
    const { sqlite, db } = fixture()
    try {
        const original = data(randomUUID())
        const first = saveNewCharacter(db, "a", original)
        assert.equal(first.id, original.uuid)
        assert.equal(saveNewCharacter(db, "a", original).id, first.id)
        assert.equal(db.select().from(schema.characters).all().length, 1)
        const conflict = saveNewCharacter(db, "a", { ...original, equipment: "Different lantern" })
        assert.notEqual(conflict.data.uuid, first.data.uuid)
        const otherOwner = saveNewCharacter(db, "b", original)
        assert.notEqual(otherOwner.data.uuid, first.data.uuid)
        assert.equal("conflict" in otherOwner, false, "another owner's sheet must not be exposed")
        db.update(schema.characters).set({ deletedAt: new Date() }).where(eq(schema.characters.id, first.id)).run()
        const restored = saveNewCharacter(db, "a", original)
        assert.notEqual(restored.id, first.id)
        const rows = db.select().from(schema.characters).all()
        assert.equal(rows.length, 4)
        assert.equal(JSON.parse(rows.find((row) => row.id === first.id)!.data).equipment, "Lantern")
        assert.ok(rows.find((row) => row.id === first.id)!.deletedAt)
        assert.ok(saveNewCharacter(db, "a", data()).data.uuid, "legacy clients receive UUIDs")
    } finally {
        sqlite.close()
    }
})

test("UUID backfill retains legacy IDs, data, soft deletions and foreign keys", () => {
    const sqlite = new Database(":memory:")
    try {
        sqlite.pragma("foreign_keys = ON")
        sqlite.exec(
            "CREATE TABLE characters (id TEXT PRIMARY KEY, data TEXT NOT NULL, deleted_at INTEGER); CREATE TABLE assignments (character_id TEXT REFERENCES characters(id));",
        )
        sqlite.prepare("INSERT INTO characters VALUES (?, ?, ?)").run("legacy-id", JSON.stringify(data()), 123)
        sqlite.prepare("INSERT INTO assignments VALUES (?)").run("legacy-id")
        sqlite.exec(readFileSync("./src/db/migrations/0008_character_uuids.sql", "utf8"))
        const row = sqlite.prepare("SELECT * FROM characters").get() as { id: string; data: string; deleted_at: number }
        const parsed = JSON.parse(row.data)
        assert.match(parsed.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        const { uuid: _uuid, ...legacy } = parsed
        assert.deepEqual(legacy, data())
        assert.equal(row.id, "legacy-id")
        assert.equal(row.deleted_at, 123)
        assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), [])
    } finally {
        sqlite.close()
    }
})

test("HTTP updates preserve conflicting versions and legacy payloads; deletion is recoverable and owner-scoped", async () => {
    process.env.DATABASE_URL = ":memory:"
    process.env.NODE_ENV = "test"
    process.env.WORKOS_API_KEY = ""
    process.env.PUBLIC_POSTHOG_KEY = ""
    const { db } = await import("../src/db/index.js")
    const { characterRoutes } = await import("../src/routes/characters.js")
    const { default: Fastify } = await import("fastify")
    migrate(db, { migrationsFolder: "./src/db/migrations" })
    db.insert(schema.users)
        .values([
            { id: "local-hivekeeper", email: "local@example.com" },
            { id: "other", email: "other@example.com" },
        ])
        .run()
    const app = Fastify()
    await app.register(characterRoutes)
    const headers = { authorization: "Bearer hiveborn-local-dev-user", host: "localhost" }
    const call = (method: "POST" | "PUT" | "GET" | "DELETE", url: string, payload?: unknown) =>
        app.inject({ method, url, headers, payload, remoteAddress: "127.0.0.1" })
    try {
        const original = (await call("POST", "/characters", { data: data() })).json()
        assert.ok(original.data.uuid)
        const changed = (await call("PUT", `/characters/${original.id}`, { baseVersion: 1, baseData: data(), changes: { equipment: "Server edit" } })).json()
        assert.equal(changed.data.uuid, original.data.uuid)
        const conflict = (await call("PUT", `/characters/${original.id}`, { baseVersion: 1, baseData: data(), changes: { equipment: "Offline edit" } })).json()
        assert.notEqual(conflict.id, original.id)
        assert.equal(conflict.data.equipment, "Offline edit")
        assert.equal(conflict.conflict.data.equipment, "Server edit")
        const deleted = (await call("DELETE", `/characters/${original.id}`)).json()
        assert.ok(deleted.character.deletedAt)
        assert.equal(deleted.character.data.equipment, "Server edit")
        const visible = (await call("GET", "/characters")).json().characters
        assert.equal(visible.length, 1)
        const all = (await call("GET", "/characters?includeDeleted=true")).json().characters
        assert.equal(all.length, 2)
        const other = saveNewCharacter(db, "other", data(randomUUID()))
        assert.equal((await call("DELETE", `/characters/${other.id}`)).statusCode, 404)
        assert.equal((await call("GET", "/characters?includeDeleted=true")).json().characters.length, 2)
    } finally {
        await app.close()
    }
})
