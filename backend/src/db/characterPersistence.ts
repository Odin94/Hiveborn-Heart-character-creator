import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import type { db as database } from "./index.js"
import { characters } from "./schema.js"
import { characterDataSchema, type CharacterData } from "../characterData.js"

const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === "object")
        return Object.fromEntries(
            Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, canonical(v)]),
        )
    return value
}
export const sameCharacterData = (a: CharacterData, b: CharacterData) => {
    const { uuid: _a, ...left } = a
    const { uuid: _b, ...right } = b
    return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}
export const serializeCharacter = (character: typeof characters.$inferSelect) => ({
    ...character,
    data: characterDataSchema.parse(JSON.parse(character.data)),
})

/** UUID retries are idempotent; collisions preserve both sheets, never overwrite. */
export function saveNewCharacter(db: typeof database, userId: string, input: CharacterData) {
    return db.transaction((tx) => {
        let uuid = input.uuid ?? randomUUID()
        const existing = tx
            .select()
            .from(characters)
            .where(sql`json_extract(${characters.data}, '$.uuid') = ${uuid}`)
            .get()
        if (existing && existing.userId === userId && !existing.deletedAt && sameCharacterData(serializeCharacter(existing).data, input)) {
            return serializeCharacter(existing)
        }
        if (existing) uuid = randomUUID()
        // New primary keys are UUIDs; legacy primary keys remain supported.
        while (tx.select({ id: characters.id }).from(characters).where(eq(characters.id, uuid)).get()) uuid = randomUUID()
        const data = { ...input, uuid }
        const character = tx
            .insert(characters)
            .values({ id: uuid, userId, name: data.name.trim() || "Unnamed hiveborn", data: JSON.stringify(data), version: 1 })
            .returning()
            .get()
        return {
            ...serializeCharacter(character),
            ...(existing?.userId === userId ? { conflict: serializeCharacter(existing) } : {}),
        }
    })
}
