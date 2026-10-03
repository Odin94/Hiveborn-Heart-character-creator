import { createHash } from "node:crypto"
import { and, eq, isNull, lte, or } from "drizzle-orm"
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
            // Filter before loading sheet JSON. Hourly checks usually have no due
            // characters, so avoid transferring every sheet and querying each checkpoint.
            const due = tx
                .select({ character: schema.characters, checkpoint: schema.characterHistoryCheckpoints })
                .from(schema.characters)
                .leftJoin(schema.characterHistoryCheckpoints, eq(schema.characterHistoryCheckpoints.characterId, schema.characters.id))
                .where(
                    and(
                        isNull(schema.characters.deletedAt),
                        or(
                            isNull(schema.characterHistoryCheckpoints.characterId),
                            lte(schema.characterHistoryCheckpoints.checkedAt, new Date(now.getTime() - WEEK_MS)),
                        ),
                    ),
                )
                .all()
            for (const { character, checkpoint } of due) {
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
