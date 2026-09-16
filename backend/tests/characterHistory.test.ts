import assert from "node:assert/strict"
import { test } from "node:test"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { eq } from "drizzle-orm"
import * as schema from "../src/db/schema.js"
import { captureCharacterHistory } from "../src/db/characterHistory.js"

const start = Date.UTC(2026, 0, 1)
const day = (n: number) => new Date(start + n * 86_400_000)
function fixture() {
    const sqlite = new Database(":memory:")
    sqlite.pragma("foreign_keys = ON")
    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: "./src/db/migrations" })
    db.insert(schema.users).values({ id: "owner", email: "owner@example.com" }).run()
    db.insert(schema.characters).values({ id: "sheet", userId: "owner", name: "Test", data: '{"name":"Test","stress":{"blood":0}}' }).run()
    const change = (value: number) =>
        db
            .update(schema.characters)
            .set({ data: JSON.stringify({ name: "Test", stress: { blood: value } }), version: value + 1 })
            .where(eq(schema.characters.id, "sheet"))
            .run()
    return { sqlite, db, change, history: () => db.select().from(schema.characterHistory).all() }
}

test("baseline, weekly changes, persistent checkpoints and 28-day expiry", () => {
    const { sqlite, db, change, history } = fixture()
    try {
        captureCharacterHistory(db, day(0))
        change(1)
        captureCharacterHistory(db, day(6))
        assert.equal(history().length, 1)
        // A fresh database wrapper models restart: scheduling has no in-memory state.
        captureCharacterHistory(drizzle(sqlite, { schema }), day(7))
        captureCharacterHistory(db, day(7))
        assert.equal(history().length, 2)
        assert.equal(history()[1].version, 2)
        assert.equal(JSON.parse(history()[1].data).stress.blood, 1)
        for (const [week, value] of [
            [2, 2],
            [3, 3],
            [4, 4],
        ]) {
            change(value)
            captureCharacterHistory(db, day(week * 7))
        }
        assert.equal(history().length, 4)
        assert.ok(history().every((row) => row.capturedAt >= day(7)))
        captureCharacterHistory(db, day(70))
        assert.equal(history().length, 0)
        captureCharacterHistory(db, day(77))
        assert.equal(history().length, 0, "expired history does not trigger duplicate snapshots")
        change(5)
        captureCharacterHistory(db, day(84))
        assert.equal(history().length, 1)
    } finally {
        sqlite.close()
    }
})

test("semantic equality skips snapshots, deleted characters expire, hard deletion cascades", () => {
    const { sqlite, db, history } = fixture()
    try {
        captureCharacterHistory(db, day(0))
        db.update(schema.characters).set({ data: '{"stress":{"blood":0},"name":"Test"}', version: 2 }).run()
        captureCharacterHistory(db, day(7))
        assert.equal(history().length, 1)
        db.update(schema.characters)
            .set({ deletedAt: day(8), data: '{"name":"Changed"}' })
            .run()
        captureCharacterHistory(db, day(14))
        assert.equal(history().length, 1)
        captureCharacterHistory(db, day(28))
        assert.equal(history().length, 0)
        db.delete(schema.characters).run()
        assert.equal(db.select().from(schema.characterHistoryCheckpoints).all().length, 0)
    } finally {
        sqlite.close()
    }
})

test("downtime produces one current snapshot and new characters get their own baseline", () => {
    const { sqlite, db, change, history } = fixture()
    try {
        captureCharacterHistory(db, day(0))
        change(2)
        db.insert(schema.characters).values({ id: "other", userId: "owner", name: "Other", data: "{}" }).run()
        captureCharacterHistory(db, day(50))
        assert.equal(history().length, 2)
        assert.ok(history().every((row) => row.capturedAt.getTime() === day(50).getTime()))
    } finally {
        sqlite.close()
    }
})
