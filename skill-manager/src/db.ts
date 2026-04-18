import postgres from "postgres"
import { Kysely } from "kysely"
import { PostgresJSDialect } from "kysely-postgres-js"
import type { Database } from "@openzerg/common/entities/kysely-database"

export type DB = Kysely<Database>

export function openDB(databaseURL: string): DB {
  const pg = postgres(databaseURL)
  return new Kysely<Database>({
    dialect: new PostgresJSDialect({ postgres: pg }),
  })
}

export async function autoMigrate(databaseURL: string): Promise<void> {
  const db = openDB(databaseURL)
  await db.schema.createTable("registry_skills")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.notNull().primaryKey())
    .addColumn("slug", "text", (col) => col.notNull().unique())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("gitUrl", "text", (col) => col.notNull())
    .addColumn("localPath", "text", (col) => col.notNull())
    .addColumn("commitHash", "text", (col) => col.notNull())
    .addColumn("pkgs", "text", (col) => col.notNull().defaultTo("[]"))
    .addColumn("createdAt", "bigint", (col) => col.notNull())
    .addColumn("updatedAt", "bigint", (col) => col.notNull())
    .execute()
  await db.destroy()
}
