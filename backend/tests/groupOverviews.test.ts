import assert from "node:assert/strict"
import { test } from "node:test"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "../src/db/schema.js"
import { getGroupOverviews } from "../src/db/groupOverviews.js"

test("batched overviews preserve requested order, assignment/membership boundaries and per-group roll limits", () => {
    const sqlite = new Database(":memory:")
    sqlite.pragma("foreign_keys = ON")
    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: "./src/db/migrations" })
    try {
        db.insert(schema.users)
            .values([
                { id: "owner", email: "owner@test.local", nickname: "Keeper" },
                { id: "other", email: "other@test.local" },
            ])
            .run()
        db.insert(schema.groups)
            .values([
                { id: "a", name: "A", ownerId: "owner" },
                { id: "b", name: "B", ownerId: "owner" },
            ])
            .run()
        db.insert(schema.groupMembers)
            .values([
                { groupId: "a", userId: "owner", isGameMaster: true },
                { groupId: "b", userId: "owner" },
            ])
            .run()
        const zero = { blood: 0, mind: 0, echo: 0, fortune: 0, supplies: 0 }
        const data = {
            name: "Sheet",
            characterClass: "Witch",
            calling: "",
            activeBeats: "",
            equipment: "",
            resources: "",
            abilities: "",
            fallout: "",
            skills: Object.fromEntries(
                ["compel", "delve", "discern", "endure", "evade", "hunt", "kill", "mend", "sneak"].map((name) => [name, { hasSkill: false, knacks: "" }]),
            ),
            domains: Object.fromEntries(
                ["cursed", "desolate", "haven", "occult", "religion", "technology", "warren", "wild"].map((name) => [name, { hasDomain: false, knacks: "" }]),
            ),
            protections: zero,
            stress: zero,
            lastStressResistance: "blood",
        }
        db.insert(schema.characters)
            .values([
                { id: "visible", userId: "owner", name: "Sheet", data: JSON.stringify(data) },
                { id: "unassigned", userId: "owner", name: "Unassigned", data: "{}" },
                { id: "outsider", userId: "other", name: "Outsider", data: "{}" },
                { id: "deleted", userId: "owner", name: "Deleted", data: "{}", deletedAt: new Date() },
            ])
            .run()
        db.insert(schema.groupCharacterAssignments)
            .values([
                { groupId: "a", characterId: "visible" },
                { groupId: "b", characterId: "visible" },
                { groupId: "a", characterId: "outsider" },
                { groupId: "a", characterId: "deleted" },
            ])
            .run()
        for (let index = 0; index < 205; index++)
            db.insert(schema.rollEvents)
                .values({
                    id: `roll-${index}`,
                    groupId: "a",
                    userId: "owner",
                    characterName: "Sheet",
                    label: "Delve",
                    dice: "2d10",
                    result: "7",
                    createdAt: new Date(1_700_000_000_000 + index * 1_000),
                })
                .run()
        db.insert(schema.rollEvents)
            .values({ id: "other-roll", groupId: "b", userId: "owner", characterName: "Sheet", label: "Delve", dice: "2d10", result: "7" })
            .run()
        const result = getGroupOverviews(db, ["b", "missing", "a"], (id) => (id === "a" ? ["owner"] : []))
        assert.deepEqual(
            result.map((group) => group.id),
            ["b", "a"],
        )
        assert.equal(result[1].members[0].isOnline, true)
        assert.equal(result[0].members[0].isOnline, false)
        assert.equal(result[1].members[0].isGameMaster, true)
        assert.deepEqual(
            result.map((group) => group.members[0].characters.map((character) => character.id)),
            [["visible"], ["visible"]],
        )
        assert.equal(result[1].rolls.length, 200)
        assert.equal(result[1].rolls[0].id, "roll-204")
        assert.equal(result[0].rolls[0].id, "other-roll")
        assert.equal(result[0].members[0].characters[0].data, result[1].members[0].characters[0].data)
        assert.deepEqual(
            getGroupOverviews(db, [], () => []),
            [],
        )
    } finally {
        sqlite.close()
    }
})
