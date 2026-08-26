import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { env } from "../config/env.js"
import * as schema from "./schema.js"

const databasePath = env.DATABASE_URL.replace(/^file:/, "")
if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true })
const sqlite = new Database(databasePath)
sqlite.pragma("foreign_keys = ON")
export const db = drizzle(sqlite, { schema })
export { schema }
