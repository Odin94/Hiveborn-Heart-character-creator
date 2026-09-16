import { createHash } from "node:crypto"
import { eq, isNull, lte } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema.js"

const WEEK_MS = 7 * 24 * 60 * 60 * 1_000

// Object key order is not a character change; array order remains significant.
function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize)
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, entry]) => [key, canonicalize(entry)]),
        )
    }
    return value
}

/** Initial baseline, then at most one snapshot per seven days, retained for 28 days. */
export function captureCharacterHistory(db: BetterSQLite3Database<typeof schema>, now = new Date()) {
    db.transaction(
        (tx) => {
            tx.delete(schema.characterHistory)
                .where(lte(schema.characterHistory.capturedAt, new Date(now.getTime() - 4 * WEEK_MS)))
                .run()
            const characters = tx.select().from(schema.characters).where(isNull(schema.characters.deletedAt)).all()
            for (const character of characters) {
                const checkpoint = tx
                    .select()
                    .from(schema.characterHistoryCheckpoints)
                    .where(eq(schema.characterHistoryCheckpoints.characterId, character.id))
                    .get()
                if (checkpoint && now.getTime() - checkpoint.checkedAt.getTime() < WEEK_MS) continue
                const dataHash = createHash("sha256")
                    .update(JSON.stringify(canonicalize(JSON.parse(character.data))))
                    .digest("hex")
                if (!checkpoint || checkpoint.dataHash !== dataHash) {
                    tx.insert(schema.characterHistory)
                        .values({ characterId: character.id, capturedAt: now, version: character.version, data: character.data })
                        .run()
                }
                // Keep this even after snapshots expire so unchanged sheets aren't saved again.
                tx.insert(schema.characterHistoryCheckpoints)
                    .values({ characterId: character.id, checkedAt: now, dataHash })
                    .onConflictDoUpdate({ target: schema.characterHistoryCheckpoints.characterId, set: { checkedAt: now, dataHash } })
                    .run()
            }
        },
        { behavior: "immediate" },
    )
}
