import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { eq } from "drizzle-orm"
import * as schema from "../src/db/schema.js"
import { characterDataSchema, type CharacterData } from "../src/characterData.js"
import { applyFallout, FalloutError } from "../src/fallout/applyFallout.js"

const sheet = (): CharacterData =>
    characterDataSchema.parse({
        uuid: randomUUID(),
        name: "Witch",
        characterClass: "Witch",
        calling: "",
        activeBeats: "",
        equipment: "Lantern",
        resources: "",
        abilities: "",
        fallout: "",
        skills: Object.fromEntries(
            ["compel", "delve", "discern", "endure", "evade", "hunt", "kill", "mend", "sneak"].map((k) => [k, { hasSkill: false, knacks: "" }]),
        ),
        domains: Object.fromEntries(
            ["cursed", "desolate", "haven", "occult", "religion", "technology", "warren", "wild"].map((k) => [k, { hasDomain: false, knacks: "" }]),
        ),
        protections: { blood: 0, mind: 0, echo: 0, fortune: 0, supplies: 0 },
        stress: { blood: 0, mind: 0, echo: 0, fortune: 0, supplies: 0 },
        lastStressResistance: "blood",
    })
const fallout = { name: "Battered", description: "Bruised" }
function fixture(initial = sheet()) {
    const sqlite = new Database(":memory:")
    sqlite.pragma("foreign_keys = ON")
    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: "./src/db/migrations" })
    db.insert(schema.users)
        .values([
            { id: "gm", email: "gm@example.com" },
            { id: "owner", email: "owner@example.com" },
            { id: "other", email: "other@example.com" },
        ])
        .run()
    db.insert(schema.groups).values({ id: "group", name: "Table", ownerId: "owner" }).run()
    db.insert(schema.groupMembers)
        .values([
            { groupId: "group", userId: "gm", isGameMaster: true },
            { groupId: "group", userId: "owner" },
        ])
        .run()
    db.insert(schema.characters)
        .values({ id: "sheet", userId: "owner", name: initial.name, data: JSON.stringify(initial) })
        .run()
    db.insert(schema.groupCharacterAssignments).values({ groupId: "group", characterId: "sheet" }).run()
    const addRoll = (id: string, patch: Partial<typeof schema.rollEvents.$inferInsert> = {}) =>
        db
            .insert(schema.rollEvents)
            .values({
                id,
                groupId: "group",
                userId: "gm",
                characterId: "sheet",
                characterName: "Witch",
                label: "Fallout",
                dice: "d12",
                result: "Minor fallout",
                createdAt: new Date(),
                ...patch,
            })
            .run()
    const row = () => db.select().from(schema.characters).where(eq(schema.characters.id, "sheet")).get()!
    const roll = (id: string) => db.select().from(schema.rollEvents).where(eq(schema.rollEvents.id, id)).get()!
    const apply = (command: Parameters<typeof applyFallout>[3], userId = "gm") => applyFallout(db, "group", userId, command)
    return { sqlite, db, addRoll, row, roll, apply }
}
const status = (code: number) => (error: unknown) => error instanceof FalloutError && error.status === code

test("the backend selects and claims a recent roll once, with GM authorization", () => {
    const f = fixture()
    try {
        f.addRoll("roll")
        const result = f.apply({ type: "assign", autoAssign: true, fallout })
        if (result.type !== "assign") assert.fail()
        assert.equal(result.response.rollId, "roll")
        assert.equal(result.response.matched, true)
        assert.equal(result.changedCharacter.version, 2)
        assert.throws(() => f.apply({ type: "assign", autoAssign: true, fallout }), status(409))
        assert.equal(f.row().version, 2)
        assert.equal(JSON.parse(f.row().data).fallout, "**Battered** - Bruised")
        assert.throws(() => f.apply({ type: "assign", characterId: "sheet", autoAssign: false, fallout }, "owner"), status(403))
        assert.throws(() => f.apply({ type: "undo", rollId: "roll" }, "other"), status(403))
    } finally {
        f.sqlite.close()
    }
})

test("expiry, severity, no fallout and latest-character eligibility are checked authoritatively", () => {
    const f = fixture()
    try {
        f.addRoll("expired", { createdAt: new Date(Date.now() - 61_000) })
        assert.throws(() => f.apply({ type: "assign", autoAssign: true, fallout }), status(409))
        f.addRoll("newer", { result: "Major fallout", createdAt: new Date(Date.now() + 1_000) })
        assert.throws(() => f.apply({ type: "assign", autoAssign: true, fallout }), status(409))
        assert.throws(() => f.apply({ type: "assign", autoAssign: true, fallout: { name: "Made up", description: "x" } }), status(400))
        assert.throws(
            () => f.apply({ type: "assign", characterId: "different", autoAssign: true, fallout: { name: "Bleeding Out", description: "x" } }),
            status(409),
        )
        assert.equal(f.apply({ type: "assign", autoAssign: true, fallout: { name: "Bleeding Out", description: "x" } }).type, "assign")
        f.addRoll("newest", { result: "No fallout", createdAt: new Date(Date.now() + 2_000) })
        assert.throws(() => f.apply({ type: "assign", autoAssign: true, fallout }), status(409))
        assert.equal(f.row().version, 2)
    } finally {
        f.sqlite.close()
    }
})

test("sheet version failure rolls back the assignment claim and leaves the roll eligible", () => {
    const f = fixture()
    try {
        f.addRoll("roll")
        f.sqlite.exec(
            "CREATE TRIGGER concurrent_sheet_edit AFTER UPDATE OF fallout_assigned_at ON roll_events BEGIN UPDATE characters SET version = version + 1 WHERE id = NEW.character_id; END",
        )
        assert.throws(() => f.apply({ type: "assign", autoAssign: true, fallout }), status(409))
        assert.equal(f.roll("roll").falloutAssignedAt, null)
        assert.equal(f.row().version, 1)
        assert.equal(JSON.parse(f.row().data).fallout, "")
        f.sqlite.exec("DROP TRIGGER concurrent_sheet_edit")
        assert.equal(f.apply({ type: "assign", autoAssign: true, fallout }).type, "assign")
    } finally {
        f.sqlite.close()
    }
})

test("undo preserves later identical assignments and unrelated sheet edits", () => {
    const original = sheet()
    original.fallout = "**Battered** - Bruised"
    const f = fixture(original)
    try {
        f.addRoll("first")
        f.apply({ type: "assign", autoAssign: true, fallout })
        f.addRoll("second", { createdAt: new Date(Date.now() + 1_000) })
        f.apply({ type: "assign", autoAssign: true, fallout })
        const changed = JSON.parse(f.row().data)
        changed.name = "Renamed"
        changed.equipment = "Another lantern"
        changed.stress.mind = 3
        f.db
            .update(schema.characters)
            .set({ data: JSON.stringify(changed), version: 4 })
            .where(eq(schema.characters.id, "sheet"))
            .run()
        const undone = f.apply({ type: "undo", rollId: "first" })
        assert.equal(undone.changedCharacter?.data.equipment, "Another lantern")
        assert.equal(undone.changedCharacter?.data.name, "Renamed")
        assert.equal(undone.changedCharacter?.data.stress.mind, 3)
        assert.equal(undone.changedCharacter?.version, 5)
        assert.equal(f.roll("first").falloutAssignedAt, null)
        assert.ok(f.roll("second").falloutAssignedAt)
        f.apply({ type: "undo", rollId: "second" })
        assert.equal(JSON.parse(f.row().data).fallout, original.fallout)
        assert.throws(() => f.apply({ type: "undo", rollId: "first" }), status(404))
    } finally {
        f.sqlite.close()
    }
})

test("edited fallout cannot be undone; removed or deleted sheets cannot be changed", () => {
    const f = fixture()
    try {
        f.addRoll("roll")
        f.apply({ type: "assign", autoAssign: true, fallout })
        const changed = JSON.parse(f.row().data)
        changed.fallout = "Edited fallout"
        f.db
            .update(schema.characters)
            .set({ data: JSON.stringify(changed), version: 3 })
            .where(eq(schema.characters.id, "sheet"))
            .run()
        assert.throws(() => f.apply({ type: "undo", rollId: "roll" }), status(409))
        assert.ok(f.roll("roll").falloutAssignedAt)
        assert.equal(f.row().version, 3)
        f.db.update(schema.characters).set({ deletedAt: new Date() }).where(eq(schema.characters.id, "sheet")).run()
        assert.throws(() => f.apply({ type: "undo", rollId: "roll" }), status(404))
        f.db.update(schema.characters).set({ deletedAt: null }).where(eq(schema.characters.id, "sheet")).run()
        f.db.delete(schema.groupCharacterAssignments).where(eq(schema.groupCharacterAssignments.characterId, "sheet")).run()
        assert.throws(() => f.apply({ type: "roll", characterId: "sheet", applyStressUpdate: true }), status(404))
    } finally {
        f.sqlite.close()
    }
})

test("roll publication failure rolls back stress and version; successful rolls commit both", () => {
    const original = sheet()
    for (const key of Object.keys(original.stress) as Array<keyof typeof original.stress>) original.stress[key] = 10
    const f = fixture(original)
    try {
        f.sqlite.exec("CREATE TRIGGER fail_roll BEFORE INSERT ON roll_events BEGIN SELECT RAISE(ABORT, 'roll failed'); END")
        assert.throws(() => f.apply({ type: "roll", characterId: "sheet", applyStressUpdate: true }), /roll failed/)
        assert.deepEqual(JSON.parse(f.row().data), original)
        assert.equal(f.row().version, 1)
        assert.equal(f.db.select().from(schema.rollEvents).all().length, 0)
        f.sqlite.exec("DROP TRIGGER fail_roll")
        const result = f.apply({ type: "roll", characterId: "sheet", applyStressUpdate: true })
        if (result.type !== "roll") assert.fail()
        assert.equal(result.response.stressUpdated, true)
        assert.equal(result.changedCharacter?.version, 2)
        assert.equal(result.sharedRoll.characterId, "sheet")
        assert.equal(f.db.select().from(schema.rollEvents).all().length, 1)
        if (result.response.fallout === "major") assert.deepEqual(JSON.parse(f.row().data).stress, { blood: 0, mind: 0, echo: 0, fortune: 0, supplies: 0 })
        else assert.deepEqual(JSON.parse(f.row().data).stress, { blood: 0, mind: 10, echo: 10, fortune: 10, supplies: 10 })
    } finally {
        f.sqlite.close()
    }
})

test("HTTP preserves auth, legacy character-targeted assignments and server-selected automatic assignments", async () => {
    process.env.DATABASE_URL = ":memory:"
    process.env.NODE_ENV = "test"
    process.env.WORKOS_API_KEY = ""
    process.env.PUBLIC_POSTHOG_KEY = ""
    const { db } = await import("../src/db/index.js")
    const { groupRoutes } = await import("../src/routes/groups.js")
    const { default: Fastify } = await import("fastify")
    migrate(db, { migrationsFolder: "./src/db/migrations" })
    db.insert(schema.users)
        .values([
            { id: "local-hivekeeper", email: "local@example.com" },
            { id: "owner", email: "owner@example.com" },
        ])
        .run()
    db.insert(schema.groups).values({ id: "http-group", name: "Table", ownerId: "owner" }).run()
    db.insert(schema.groupMembers).values({ groupId: "http-group", userId: "local-hivekeeper", isGameMaster: false }).run()
    const original = sheet()
    db.insert(schema.characters)
        .values({ id: "http-sheet", userId: "owner", name: original.name, data: JSON.stringify(original) })
        .run()
    db.insert(schema.groupCharacterAssignments).values({ groupId: "http-group", characterId: "http-sheet" }).run()
    const app = Fastify()
    await app.register(groupRoutes)
    const url = "/play-groups/http-group/fallout-assignments"
    const call = (path: string, payload: unknown) =>
        app.inject({
            method: "POST",
            url: path,
            payload,
            headers: { authorization: "Bearer hiveborn-local-dev-user", host: "localhost" },
            remoteAddress: "127.0.0.1",
        })
    try {
        assert.equal((await app.inject({ method: "POST", url, payload: { characterId: "http-sheet", fallout } })).statusCode, 401)
        assert.equal((await call(url, { characterId: "http-sheet", fallout })).statusCode, 403)
        db.update(schema.groupMembers).set({ isGameMaster: true }).where(eq(schema.groupMembers.groupId, "http-group")).run()
        assert.equal((await call(url, { fallout })).statusCode, 400)
        assert.equal((await call(url, { autoAssign: true, fallout })).statusCode, 409)
        const legacy = await call(url, { characterId: "http-sheet", fallout })
        assert.equal(legacy.statusCode, 200)
        assert.equal(legacy.json().matched, false)
        db.insert(schema.rollEvents)
            .values({
                id: "http-roll",
                groupId: "http-group",
                userId: "local-hivekeeper",
                characterId: "http-sheet",
                characterName: original.name,
                label: "Fallout",
                dice: "d12",
                result: "Minor fallout",
            })
            .run()
        const automatic = await call(url, { autoAssign: true, fallout })
        assert.equal(automatic.statusCode, 200)
        assert.equal(automatic.json().matched, true)
        assert.equal(automatic.json().rollId, "http-roll")
        assert.equal(automatic.json().character.version, 3)
        const undone = await call(`${url}/undo`, { rollId: "http-roll" })
        assert.equal(undone.statusCode, 200)
        assert.equal(undone.json().character.version, 4)
        assert.equal(undone.json().character.data.fallout, legacy.json().character.data.fallout)
        assert.equal((await call(url, { characterId: "outside-group", fallout })).statusCode, 404)
    } finally {
        await app.close()
    }
})

test("undo restores the original freeform fallout text including its surrounding whitespace", () => {
    const original = sheet()
    original.fallout = "  A personal curse\n\nKeep this paragraph.  \n"
    const f = fixture(original)
    try {
        f.addRoll("roll")
        f.apply({ type: "assign", autoAssign: true, fallout })
        f.apply({ type: "undo", rollId: "roll" })
        assert.equal(JSON.parse(f.row().data).fallout, original.fallout)
    } finally {
        f.sqlite.close()
    }
})
