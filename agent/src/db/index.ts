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
