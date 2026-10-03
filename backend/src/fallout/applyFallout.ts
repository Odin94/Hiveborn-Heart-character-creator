import { randomInt } from "node:crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import { nanoid } from "nanoid"
import type { db as database } from "../db/index.js"
import * as schema from "../db/schema.js"
import { characterDataSchema, type CharacterData } from "../characterData.js"

export class FalloutError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message)
    }
}
export type FalloutCommand =
    | { type: "roll"; characterId: string; applyStressUpdate: boolean }
    | { type: "assign"; characterId?: string; autoAssign: boolean; fallout: { name: string; description: string } }
    | { type: "undo"; rollId: string }

type UpdatedCharacter = Omit<typeof schema.characters.$inferSelect, "data"> & { data: CharacterData }

const falloutRollWindowMs = 60_000
const falloutNamesBySeverity = {
    minor: new Set(
        "Battered|Bleeding|Disarmed|Furious|Limping|Ringing Head|Shattered|Spitting Teeth|Tired|Winded|Clouded|Creepy|Collateral Magic|Fascination|Figment|Shaken|Take the Edge Off|Vulnerable|Weird|Buboes|Conduit|Deja Vu|Exodus|Follower|Glitch|Hex-Eye|The Ravening Call|Strange Appetite|Siren Song|Broken|Collateral|Foreboding|The Hard Way|In Trouble|Long Way Round|Separated|Unlucky|Word of Mouth|Damaged|Darkness|Debtor|Empty|Half Rations|Out of Ammo|Used Up".split(
            "|",
        ),
    ),
    major: new Set(
        "Arterial Wound|Blinded|Broken Arm|Broken Leg|Critical Injury|Downed|Exhausted|Aetheric Resonance|Addict|Delusion|Despair|Memory Holes|Phantasm|Scarred|Unsettling|Blooded|Cult|Dark Cravings|Eyes|The Life Not Lived|Meat|Mirage|The Ravening Beast|Reconfigured Physiology|Vanished|Crisis|Destroyed|Exiled|Grievance|Hell for Weather|Lost Map|Lost Property|No Way Out|Reputation|The Road Less Travelled|Unwilling Leader|In the Dark|No Rations|Services Rendered|Sold|Spoiled".split(
            "|",
        ),
    ),
    critical: new Set(
        "Bleeding Out|Chosen|Ghost|Beast|Burst|Descent|Messiah|Petrified|The Ravening|Stranded|Abandon|Break|Obsessed|Fool's Gold|Heavy Hangs the Head|A Slow and Insidious Killer|Wrong Place|Defenceless|Pitch Black|Plummet|Starvation".split(
            "|",
        ),
    ),
} as const

const falloutOutcomeForRoll = (result: string) => {
    const match = /^(minor|major) fallout\b/i.exec(result.trim())
    return match?.[1]?.toLowerCase() as "minor" | "major" | undefined
}

const falloutSeverityFor = (name: string) =>
    Object.entries(falloutNamesBySeverity).find(([, names]) => names.has(name))?.[0] as "minor" | "major" | "critical" | undefined

const falloutEntry = ({ name, description }: { name: string; description: string }) => `**${name}** - ${description}`

// Match the occurrence anchored to the original following text, from the end so
// a newer identical entry cannot steal an older assignment's undo.
const falloutEntryPosition = (fallout: string, entry: string, followingText: string | null) => {
    const index = followingText === "" ? fallout.lastIndexOf(entry) : fallout.lastIndexOf(followingText ? `${entry}\n\n${followingText}` : entry)
    if (index < 0 || (index > 0 && fallout.slice(index - 2, index) !== "\n\n")) return -1
    if (followingText === "" && fallout.slice(index + entry.length).trim()) return -1
    return index
}
const removeFalloutEntry = (fallout: string, entry: string, followingText: string | null) => {
    const index = falloutEntryPosition(fallout, entry, followingText)
    if (index < 0) return null
    if (followingText === "") return `${fallout.slice(0, index).replace(/\n{2}$/, "")}${fallout.slice(index + entry.length)}`
    return `${fallout.slice(0, index)}${fallout.slice(index + entry.length).replace(/^\n{2}/, "")}`
}

/** The database transaction owns authorization, eligibility, claims and sheet writes.
 * Effects are returned only after commit, so transports cannot publish partial changes.
 */
export function applyFallout(db: typeof database, groupId: string, userId: string, command: FalloutCommand) {
    try {
        return db.transaction(
            (tx) => {
                const gm = tx
                    .select()
                    .from(schema.groupMembers)
                    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId), eq(schema.groupMembers.isGameMaster, true)))
                    .get()
                if (!gm)
                    throw new FalloutError(
                        403,
                        command.type === "roll"
                            ? "Only assigned game masters can roll fallout"
                            : command.type === "undo"
                              ? "Only assigned game masters can undo fallout assignments"
                              : "Only assigned game masters can assign fallout",
                    )
                let matchedRoll: typeof schema.rollEvents.$inferSelect | undefined
                let characterId = command.type === "undo" ? undefined : command.characterId
                if (command.type === "assign" && command.autoAssign) {
                    matchedRoll = tx
                        .select()
                        .from(schema.rollEvents)
                        .where(and(eq(schema.rollEvents.groupId, groupId), eq(schema.rollEvents.label, "Fallout")))
                        .orderBy(desc(schema.rollEvents.createdAt), desc(schema.rollEvents.id))
                        .limit(1)
                        .get()
                    const severity = falloutSeverityFor(command.fallout.name)
                    if (!severity) throw new FalloutError(400, "Unknown fallout option")
                    const outcome = matchedRoll ? falloutOutcomeForRoll(matchedRoll.result) : undefined
                    if (
                        !matchedRoll?.characterId ||
                        (characterId && matchedRoll.characterId !== characterId) ||
                        matchedRoll.falloutAssignedAt ||
                        matchedRoll.createdAt.getTime() < Date.now() - falloutRollWindowMs ||
                        !outcome ||
                        (severity !== "critical" && severity !== outcome)
                    )
                        throw new FalloutError(409, "That fallout roll or character changed; please try again")
                    characterId = matchedRoll.characterId
                } else if (command.type === "undo") {
                    matchedRoll = tx
                        .select()
                        .from(schema.rollEvents)
                        .where(and(eq(schema.rollEvents.id, command.rollId), eq(schema.rollEvents.groupId, groupId)))
                        .get()
                    if (!matchedRoll?.characterId || !matchedRoll.falloutAssignedAt || !matchedRoll.falloutAssignmentEntry)
                        throw new FalloutError(404, "Fallout assignment not found")
                    characterId = matchedRoll.characterId
                }
                const character = characterId
                    ? tx
                          .select()
                          .from(schema.characters)
                          .where(and(eq(schema.characters.id, characterId), isNull(schema.characters.deletedAt)))
                          .get()
                    : undefined
                const assignment = character
                    ? tx
                          .select()
                          .from(schema.groupCharacterAssignments)
                          .where(and(eq(schema.groupCharacterAssignments.groupId, groupId), eq(schema.groupCharacterAssignments.characterId, character.id)))
                          .get()
                    : undefined
                if (!character || !assignment) throw new FalloutError(404, "Character not found in this group")
                const data = characterDataSchema.parse(JSON.parse(character.data))
                const save = (): UpdatedCharacter => {
                    const updated = tx
                        .update(schema.characters)
                        .set({ data: JSON.stringify(data), updatedAt: new Date(), version: character.version + 1 })
                        .where(
                            and(eq(schema.characters.id, character.id), eq(schema.characters.version, character.version), isNull(schema.characters.deletedAt)),
                        )
                        .returning()
                        .get()
                    if (!updated) throw new FalloutError(409, "Character changed while applying fallout; please try again")
                    return { ...updated, data }
                }
                if (command.type === "roll") {
                    const totalStress = Object.values(data.stress).reduce((total, value) => total + value, 0)
                    const roll = randomInt(1, 13)
                    const fallout = roll <= totalStress ? (roll >= 7 ? ("major" as const) : ("minor" as const)) : null
                    let stressUpdate: { type: "all" } | { type: "resistance"; resistance: string } | null = null
                    if (fallout && command.applyStressUpdate) {
                        if (fallout === "major") {
                            for (const key of Object.keys(data.stress) as Array<keyof typeof data.stress>) data.stress[key] = 0
                            stressUpdate = { type: "all" }
                        } else if (data.lastStressResistance) {
                            data.stress[data.lastStressResistance] = 0
                            stressUpdate = { type: "resistance", resistance: data.lastStressResistance }
                        }
                    }
                    const changedCharacter = stressUpdate ? save() : undefined
                    const outcome = fallout ? `${fallout[0].toUpperCase()}${fallout.slice(1)} fallout` : "No fallout"
                    const summary = stressUpdate?.type === "all" ? "set all stress to 0" : stressUpdate ? `set ${stressUpdate.resistance} stress to 0` : ""
                    const sharedRoll = tx
                        .insert(schema.rollEvents)
                        .values({
                            id: nanoid(),
                            groupId,
                            userId,
                            characterId: character.id,
                            characterName: character.name || "Unnamed hiveborn",
                            label: "Fallout",
                            dice: "d12",
                            result: summary ? `${outcome} — ${summary}` : outcome,
                        })
                        .returning()
                        .get()
                    return {
                        type: "roll" as const,
                        ownerId: character.userId,
                        changedCharacter,
                        sharedRoll,
                        response: {
                            characterId: character.id,
                            totalStress,
                            roll,
                            fallout,
                            stressUpdated: Boolean(stressUpdate),
                            stressUpdate,
                            lastStressResistance: data.lastStressResistance ?? null,
                        },
                    }
                }
                if (command.type === "assign") {
                    const severity = falloutSeverityFor(command.fallout.name)
                    if (!severity) throw new FalloutError(400, "Unknown fallout option")
                    const entry = falloutEntry(command.fallout)
                    const followingText = data.fallout.trim() ? data.fallout : ""
                    data.fallout = followingText ? `${entry}\n\n${followingText}` : entry
                    if (matchedRoll) {
                        const claimed = tx
                            .update(schema.rollEvents)
                            .set({ falloutAssignedAt: new Date(), falloutAssignmentEntry: entry, falloutAssignmentFollowingText: followingText })
                            .where(and(eq(schema.rollEvents.id, matchedRoll.id), isNull(schema.rollEvents.falloutAssignedAt)))
                            .returning()
                            .get()
                        if (!claimed) throw new FalloutError(409, "That fallout roll or character changed; please try again")
                    }
                    const changedCharacter = save()
                    return {
                        type: "assign" as const,
                        ownerId: character.userId,
                        changedCharacter,
                        severity,
                        response: { character: changedCharacter, matched: Boolean(matchedRoll), rollId: matchedRoll?.id ?? null },
                    }
                }
                const roll = matchedRoll!
                const fallout = removeFalloutEntry(data.fallout, roll.falloutAssignmentEntry!, roll.falloutAssignmentFollowingText)
                if (fallout === null) throw new FalloutError(409, "The fallout entry changed and can no longer be undone automatically")
                // Undo may remove text that anchors a newer assignment. Rebase those
                // anchors in the same transaction so every remaining undo stays precise.
                const removedPosition = falloutEntryPosition(data.fallout, roll.falloutAssignmentEntry!, roll.falloutAssignmentFollowingText)
                const otherAssignments = tx.select().from(schema.rollEvents).where(eq(schema.rollEvents.characterId, character.id)).all()
                for (const other of otherAssignments) {
                    if (other.id === roll.id || !other.falloutAssignedAt || !other.falloutAssignmentEntry || other.falloutAssignmentFollowingText === null)
                        continue
                    const position = falloutEntryPosition(data.fallout, other.falloutAssignmentEntry, other.falloutAssignmentFollowingText)
                    if (position < 0 || position >= removedPosition) continue
                    const followingText = removeFalloutEntry(
                        other.falloutAssignmentFollowingText,
                        roll.falloutAssignmentEntry!,
                        roll.falloutAssignmentFollowingText,
                    )
                    if (followingText !== null)
                        tx.update(schema.rollEvents).set({ falloutAssignmentFollowingText: followingText }).where(eq(schema.rollEvents.id, other.id)).run()
                }
                data.fallout = fallout
                const released = tx
                    .update(schema.rollEvents)
                    .set({ falloutAssignedAt: null, falloutAssignmentEntry: null, falloutAssignmentFollowingText: null })
                    .where(
                        and(
                            eq(schema.rollEvents.id, roll.id),
                            eq(schema.rollEvents.falloutAssignmentEntry, roll.falloutAssignmentEntry!),
                            eq(schema.rollEvents.falloutAssignedAt, roll.falloutAssignedAt!),
                        ),
                    )
                    .returning()
                    .get()
                if (!released) throw new FalloutError(409, "Fallout assignment changed while undoing; please try again")
                const changedCharacter = save()
                return { type: "undo" as const, ownerId: character.userId, changedCharacter, response: { character: changedCharacter } }
            },
            { behavior: "immediate" },
        )
    } catch (error) {
        const failure = error as { code?: string; cause?: { code?: string } }
        if (/^SQLITE_(BUSY|LOCKED)/.test(failure.code ?? failure.cause?.code ?? ""))
            throw new FalloutError(409, "That fallout roll or character changed; please try again")
        throw error
    }
}
