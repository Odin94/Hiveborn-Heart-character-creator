// This smoke fixture is restricted to an explicit disposable database.
import { resolve } from "node:path"
const target = process.argv[2]
if (!target || !resolve(target).endsWith("hiveborn-all-views-data/hiveborn.sqlite")) throw new Error("Pass the disposable all-views database path")
process.env.DATABASE_URL = resolve(target)
process.env.PUBLIC_POSTHOG_KEY = ""
const { db, schema } = await import("../src/db/index.js")
const { getEmptyCharacter } = await import("../../src/hiveborn/game_data/character.js")
const { eq } = await import("drizzle-orm")
const group = db.select().from(schema.groups).where(eq(schema.groups.name, "Performance smoke table")).get()!
db.update(schema.groupMembers).set({ isGameMaster: true }).where(eq(schema.groupMembers.userId, "local-hivekeeper")).run()
for (let index = 0; index < 4; index++) {
    const id = `smoke-player-${index}`
    db.insert(schema.users)
        .values({ id, email: `${id}@example.test`, nickname: `SmokePlayer${index}` })
        .onConflictDoNothing()
        .run()
    db.insert(schema.groupMembers).values({ groupId: group.id, userId: id }).onConflictDoNothing().run()
    const characterId = `smoke-sheet-${index}`
    const data = {
        ...getEmptyCharacter(),
        uuid: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        name: `Honey Witch ${index}`,
        characterClass: "Witch",
        calling: "Adventure",
        abilities: "**Honeyed Words:** Make a bargain.",
        equipment: "Lantern",
        resources: "D6 Honey",
        fallout: "**Bruised:** Keep moving.",
        activeBeats: "Discover a strange secret",
        stress: { ...getEmptyCharacter().stress, blood: 4 },
    }
    db.insert(schema.characters)
        .values({ id: characterId, userId: id, name: data.name, data: JSON.stringify(data) })
        .onConflictDoUpdate({ target: schema.characters.id, set: { data: JSON.stringify(data) } })
        .run()
    db.insert(schema.groupCharacterAssignments).values({ groupId: group.id, characterId }).onConflictDoNothing().run()
    db.insert(schema.rollEvents)
        .values({ id: `smoke-roll-${index}`, groupId: group.id, userId: id, characterId, characterName: data.name, label: "Delve", dice: "2d10", result: "7" })
        .onConflictDoNothing()
        .run()
}
for (const id of ["smoke-invite-accept", "smoke-invite-decline"]) {
    db.insert(schema.groups).values({ id, name: id, ownerId: "smoke-player-0" }).onConflictDoNothing().run()
    db.insert(schema.groupMembers).values({ groupId: id, userId: "smoke-player-0", isGameMaster: true }).onConflictDoNothing().run()
    db.insert(schema.groupInvitations).values({ groupId: id, userId: "local-hivekeeper", invitedByUserId: "smoke-player-0" }).onConflictDoNothing().run()
}
db.$client.close()
