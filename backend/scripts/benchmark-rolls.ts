import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { desc, eq } from "drizzle-orm"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as schema from "../src/db/schema.js"

const baselineRef = process.argv[2]
let migrationsFolder = "./src/db/migrations"
let temporaryDirectory: string | undefined
if (baselineRef) {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "hiveborn-roll-benchmark-"))
    const archive = execFileSync("git", ["archive", baselineRef, "src/db/migrations"], { maxBuffer: 10 * 1024 * 1024 })
    execFileSync("tar", ["-x", "-C", temporaryDirectory], { input: archive })
    migrationsFolder = join(temporaryDirectory, "src/db/migrations")
}
const sqlite = new Database(":memory:")
sqlite.pragma("foreign_keys = ON")
const db = drizzle(sqlite, { schema })
try {
    migrate(db, { migrationsFolder })
    sqlite.prepare("INSERT INTO users (id, email) VALUES ('benchmark', 'benchmark@example.com')").run()
    const insertGroup = sqlite.prepare("INSERT INTO play_groups (id, name, owner_id) VALUES (?, 'Table', 'benchmark')")
    const insertRoll = sqlite.prepare(
        "INSERT INTO roll_events (id, group_id, user_id, character_name, label, dice, result, created_at) VALUES (?, ?, 'benchmark', 'Witch', 'Delve', '2d10', '7', ?)",
    )
    sqlite.transaction(() => {
        for (let group = 0; group < 20; group++) insertGroup.run(`group-${group}`)
        for (let index = 0; index < 100_000; index++) insertRoll.run(`roll-${index}`, `group-${index % 20}`, 1_700_000_000 + index)
    })()
    const query = db.select().from(schema.rollEvents).where(eq(schema.rollEvents.groupId, "group-7")).orderBy(desc(schema.rollEvents.createdAt)).limit(200)
    const plan = sqlite.prepare("EXPLAIN QUERY PLAN " + query.toSQL().sql).all(...query.toSQL().params)
    const durations = []
    for (let round = 0; round < 21; round++) {
        const started = performance.now()
        const records = query.all()
        if (records.length !== 200 || records[0].groupId !== "group-7") throw new Error("Incorrect roll results")
        durations.push(performance.now() - started)
    }
    const samples = durations.slice(1).sort((a, b) => a - b)
    console.log(
        JSON.stringify({
            benchmark: "group-roll-history",
            source: baselineRef ?? "working-tree",
            totalRolls: 100_000,
            groups: 20,
            rowsReturned: 200,
            medianMs: samples[Math.floor(samples.length / 2)],
            p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
            plan,
            samples,
        }),
    )
} finally {
    sqlite.close()
    if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true })
}
