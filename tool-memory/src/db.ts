import { Kysely, type Generated } from "kysely"
import pg from "postgres"
import { PostgresJSDialect } from "kysely-postgres-js"

export interface MemoryDatabase {
  memory_entries: {
    id: Generated<string>
    bucket_name: string
    key: string
    value: string
    created_at: bigint
    updated_at: bigint
  }
  todo_entries: {
    session_id: string
    position: number
    content: string
    status: Generated<string>
    priority: Generated<string>
    created_at: bigint
    updated_at: bigint
  }
}

export type DB = Kysely<MemoryDatabase>

export function openMemoryDB(databaseUrl: string): DB {
  const sql = pg(databaseUrl)
  return new Kysely<MemoryDatabase>({
    dialect: new PostgresJSDialect({ postgres: sql }),
  })
}

export async function autoMigrate(db: DB): Promise<void> {
  await db.schema.createTable("memory_entries")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.notNull().primaryKey())
    .addColumn("bucket_name", "text", (col) => col.notNull())
    .addColumn("key", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .addColumn("updated_at", "bigint", (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex("idx_memory_bucket_key")
    .ifNotExists()
    .on("memory_entries")
    .columns(["bucket_name", "key"])
    .unique()
    .execute()

  await db.schema.createTable("todo_entries")
    .ifNotExists()
    .addColumn("session_id", "text", (col) => col.notNull())
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("priority", "text", (col) => col.notNull().defaultTo("medium"))
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .addColumn("updated_at", "bigint", (col) => col.notNull())
    .addPrimaryKeyConstraint("todo_pk", ["session_id", "position"])
    .execute()

  await db.schema
    .createIndex("idx_todo_session")
    .ifNotExists()
    .on("todo_entries")
    .columns(["session_id"])
    .execute()
}
