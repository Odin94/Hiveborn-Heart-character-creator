import { relations, sql } from "drizzle-orm"
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

const timestamps = {
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
}

export const users = sqliteTable(
    "users",
    {
        id: text("id").primaryKey(),
        email: text("email").notNull().unique(),
        firstName: text("first_name"),
        lastName: text("last_name"),
        nickname: text("nickname"),
        ...timestamps,
    },
    // Nicknames are identifiers used for invitations. Treat casing as display
    // only, so `HoneyWitch` cannot be claimed a second time as `honeywitch`.
    (table) => ({ nicknameUnique: uniqueIndex("users_nickname_unique").on(sql`${table.nickname} COLLATE NOCASE`) }),
)

export const characters = sqliteTable(
    "characters",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        data: text("data").notNull(),
        version: integer("version").notNull().default(1),
        deletedAt: integer("deleted_at", { mode: "timestamp" }),
        ...timestamps,
    },
    (table) => ({ userIdx: index("characters_user_idx").on(table.userId) }),
)

export const groups = sqliteTable(
    "play_groups",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        ownerId: text("owner_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        ...timestamps,
    },
    (table) => ({ ownerIdx: index("groups_owner_idx").on(table.ownerId) }),
)

export const groupMembers = sqliteTable(
    "play_group_members",
    {
        groupId: text("group_id")
            .notNull()
            .references(() => groups.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        joinedAt: integer("joined_at", { mode: "timestamp" })
            .notNull()
            .default(sql`(unixepoch())`),
    },
    (table) => ({ pk: primaryKey({ columns: [table.groupId, table.userId] }), userIdx: index("group_members_user_idx").on(table.userId) }),
)

export const groupCharacterAssignments = sqliteTable(
    "play_group_character_assignments",
    {
        groupId: text("group_id")
            .notNull()
            .references(() => groups.id, { onDelete: "cascade" }),
        characterId: text("character_id")
            .notNull()
            .references(() => characters.id, { onDelete: "cascade" }),
        assignedAt: integer("assigned_at", { mode: "timestamp" })
            .notNull()
            .default(sql`(unixepoch())`),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.groupId, table.characterId] }),
        characterIdx: index("group_character_assignments_character_idx").on(table.characterId),
    }),
)

export const rollEvents = sqliteTable("roll_events", {
    id: text("id").primaryKey(),
    groupId: text("group_id")
        .notNull()
        .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    characterName: text("character_name").notNull(),
    label: text("label").notNull(),
    dice: text("dice").notNull(),
    result: text("result").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
})

export const groupRelations = relations(groups, ({ many }) => ({
    members: many(groupMembers),
    characterAssignments: many(groupCharacterAssignments),
    rolls: many(rollEvents),
}))
