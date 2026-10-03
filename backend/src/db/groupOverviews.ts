import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import type { db as database } from "./index.js"
import * as schema from "./schema.js"
import { characterDataSchema, type CharacterData } from "../characterData.js"

/** Fetch membership-scoped overviews in batches; never load unassigned sheet JSON. */
export function getGroupOverviews(db: typeof database, groupIds: string[], onlineIds: (groupId: string) => string[]) {
    if (!groupIds.length) return []
    const groups = db.select().from(schema.groups).where(inArray(schema.groups.id, groupIds)).all()
    const memberships = db
        .select({ member: schema.groupMembers, nickname: schema.users.nickname })
        .from(schema.groupMembers)
        .leftJoin(schema.users, eq(schema.users.id, schema.groupMembers.userId))
        .where(inArray(schema.groupMembers.groupId, groupIds))
        .all()
    const assigned = db
        .select({ groupId: schema.groupCharacterAssignments.groupId, character: schema.characters })
        .from(schema.groupCharacterAssignments)
        .innerJoin(schema.characters, eq(schema.characters.id, schema.groupCharacterAssignments.characterId))
        .innerJoin(
            schema.groupMembers,
            and(eq(schema.groupMembers.groupId, schema.groupCharacterAssignments.groupId), eq(schema.groupMembers.userId, schema.characters.userId)),
        )
        .where(and(inArray(schema.groupCharacterAssignments.groupId, groupIds), isNull(schema.characters.deletedAt)))
        .all()
    const membersByGroup = new Map<string, typeof memberships>()
    for (const row of memberships) {
        const members = membersByGroup.get(row.member.groupId) ?? []
        members.push(row)
        membersByGroup.set(row.member.groupId, members)
    }
    const charactersByMembership = new Map<string, typeof assigned>()
    const dataByCharacter = new Map<string, CharacterData>()
    for (const row of assigned) {
        const key = JSON.stringify([row.groupId, row.character.userId])
        const characters = charactersByMembership.get(key) ?? []
        characters.push(row)
        charactersByMembership.set(key, characters)
        if (!dataByCharacter.has(row.character.id)) dataByCharacter.set(row.character.id, characterDataSchema.parse(JSON.parse(row.character.data)))
    }
    const groupsById = new Map(groups.map((group) => [group.id, group]))
    return groupIds.flatMap((id) => {
        const group = groupsById.get(id)
        if (!group) return []
        const online = new Set(onlineIds(id))
        return [
            {
                id: group.id,
                name: group.name,
                ownerId: group.ownerId,
                createdAt: group.createdAt,
                members: (membersByGroup.get(id) ?? []).map(({ member, nickname }) => ({
                    id: member.userId,
                    nickname,
                    joinedAt: member.joinedAt,
                    isGameMaster: member.isGameMaster,
                    isOnline: online.has(member.userId),
                    characters: (charactersByMembership.get(JSON.stringify([id, member.userId])) ?? []).map(({ character }) => ({
                        id: character.id,
                        name: character.name,
                        data: dataByCharacter.get(character.id)!,
                        version: character.version,
                        updatedAt: character.updatedAt,
                    })),
                })),
                // Keep the indexed per-group LIMIT so quiet groups don't inherit another
                // table's history or materialize an unbounded list before slicing.
                rolls: db.select().from(schema.rollEvents).where(eq(schema.rollEvents.groupId, id)).orderBy(desc(schema.rollEvents.createdAt)).limit(200).all(),
            },
        ]
    })
}
