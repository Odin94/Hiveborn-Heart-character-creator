import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { execFileSync } from "node:child_process"
import { writeFileSync, unlinkSync } from "node:fs"
import { randomUUID } from "node:crypto"
import * as schema from "../src/db/schema.js"

const baselineRef = process.argv[2]
let historyModule = new URL("../src/db/characterHistory.js", import.meta.url)
if (baselineRef) {
    historyModule = new URL(`../src/db/.history-benchmark-${randomUUID()}.ts`, import.meta.url)
    writeFileSync(historyModule, execFileSync("git", ["show", `${baselineRef}:backend/src/db/characterHistory.ts`]))
}
let captureCharacterHistory: typeof import("../src/db/characterHistory.js").captureCharacterHistory
try {
    ;({ captureCharacterHistory } = await import(historyModule.href))
} finally {
    if (baselineRef) unlinkSync(historyModule)
}

const sqlite = new Database(":memory:")
sqlite.pragma("foreign_keys = ON")
const db = drizzle(sqlite, { schema })
migrate(db, { migrationsFolder: "./src/db/migrations" })
const now = new Date("2026-01-01T00:00:00Z")
const insertUser = sqlite.prepare("INSERT INTO users (id, email) VALUES (?, ?)")
const insertCharacter = sqlite.prepare("INSERT INTO characters (id, user_id, name, data) VALUES (?, ?, ?, ?)")
sqlite.transaction(() => {
    insertUser.run("benchmark", "benchmark@example.com")
    for (let index = 0; index < 5_000; index++) {
        insertCharacter.run(
            `sheet-${index}`,
            "benchmark",
            "Witch",
            JSON.stringify({ name: "Witch", abilities: "Spell text. ".repeat(500), stress: { blood: 0 }, uuid: `sheet-${index}` }),
        )
    }
})()
try {
    captureCharacterHistory(db, now)
    for (const scenario of ["not-due", "all-due"] as const) {
        const durations = []
        const rounds = scenario === "not-due" ? 16 : 7
        for (let round = 0; round < rounds; round++) {
            const started = performance.now()
            captureCharacterHistory(db, new Date(now.getTime() + (scenario === "not-due" ? 60_000 : (round + 1) * 7 * 86_400_000)))
            durations.push(performance.now() - started)
        }
        const samples = durations.slice(1).sort((a, b) => a - b)
        console.log(
            JSON.stringify({
                benchmark: `history-${scenario}`,
                source: baselineRef ?? "working-tree",
                characters: 5_000,
                medianMs: samples[Math.floor(samples.length / 2)],
                p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
                samples,
            }),
        )
    }
} finally {
    sqlite.close()
}
