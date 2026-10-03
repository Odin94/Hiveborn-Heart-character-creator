import { execFileSync } from "node:child_process"
import { writeFileSync, unlinkSync } from "node:fs"
import { randomUUID } from "node:crypto"
import Fastify from "fastify"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

process.env.DATABASE_URL = ":memory:"
process.env.NODE_ENV = "test"
process.env.PUBLIC_POSTHOG_KEY = ""
const { db, schema } = await import("../src/db/index.js")
migrate(db, { migrationsFolder: "./src/db/migrations" })
const ref = process.argv[2]
let moduleUrl = new URL("../src/routes/groups.js", import.meta.url)
if (ref) {
    moduleUrl = new URL(`../src/routes/.groups-benchmark-${randomUUID()}.ts`, import.meta.url)
    writeFileSync(moduleUrl, execFileSync("git", ["show", `${ref}:backend/src/routes/groups.ts`]))
}
let groupRoutes: typeof import("../src/routes/groups.js").groupRoutes
try {
    ;({ groupRoutes } = await import(moduleUrl.href))
} finally {
    if (ref) unlinkSync(moduleUrl)
}
const { getEmptyCharacter } = await import("../../src/hiveborn/game_data/character.js")
const owner = "local-hivekeeper"
db.insert(schema.users).values({ id: owner, email: "benchmark@example.com", nickname: "Keeper" }).run()
const sqlite = db.$client
const insertCharacter = sqlite.prepare("INSERT INTO characters (id, user_id, name, data) VALUES (?, ?, ?, ?)")
sqlite.transaction(() => {
    for (let index = 0; index < 100; index++)
        insertCharacter.run(`sheet-${index}`, owner, `Sheet ${index}`, JSON.stringify({ ...getEmptyCharacter(), abilities: "Spell ".repeat(2_000) }))
    for (let index = 0; index < 20; index++) {
        db.insert(schema.groups)
            .values({ id: `group-${index}`, ownerId: owner, name: `Table ${index}` })
            .run()
        db.insert(schema.groupMembers)
            .values({ groupId: `group-${index}`, userId: owner, isGameMaster: true })
            .run()
        for (let sheet = 0; sheet < 5; sheet++)
            db.insert(schema.groupCharacterAssignments)
                .values({ groupId: `group-${index}`, characterId: `sheet-${sheet}` })
                .run()
    }
})()
const app = Fastify()
await app.register(groupRoutes)
let queryCount = 0
const prepare = sqlite.prepare.bind(sqlite)
sqlite.prepare = ((...args: Parameters<typeof sqlite.prepare>) => {
    queryCount++
    return prepare(...args)
}) as typeof sqlite.prepare
try {
    const samples = []
    for (let index = 0; index < 8; index++) {
        queryCount = 0
        const started = performance.now()
        const response = await app.inject({
            method: "GET",
            url: "/play-groups",
            headers: { host: "localhost:3312", authorization: "Bearer hiveborn-local-dev-user" },
        })
        const elapsedMs = performance.now() - started
        if (response.statusCode !== 200) throw new Error(response.body)
        const result = response.json()
        if (result.groups.length !== 20 || result.groups.some((group: { members: { characters: unknown[] }[] }) => group.members[0].characters.length !== 5))
            throw new Error("Incorrect groups")
        samples.push({ elapsedMs, queries: queryCount, responseBytes: Buffer.byteLength(response.body) })
    }
    const values = samples
        .slice(1)
        .map((sample) => sample.elapsedMs)
        .sort((a, b) => a - b)
    console.log(
        JSON.stringify({
            benchmark: "authenticated-group-overviews",
            source: ref ?? "working-tree",
            groups: 20,
            savedSheets: 100,
            assignedSheetsPerGroup: 5,
            samples: samples.slice(1),
            medianMs: values[3],
        }),
    )
} finally {
    await app.close()
    sqlite.close()
}
