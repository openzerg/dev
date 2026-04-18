/**
 * codegen-entities.ts — Bun script
 *
 * Reads JSON Schema YAML files from generated/@typespec/json-schema/
 * that have x-table annotation, and generates:
 *
 *   generated/ts/entities/{name}-schema.ts   — Zod schemas + z.infer<> types
 *   generated/ts/entities/kysely-database.ts  — Kysely Database interface
 *   generated/ts/entities/migrations.sql      — PostgreSQL CREATE TABLE DDL
 *
 * Type mapping:
 *   TypeSpec int64  → JSON Schema "type:string" → bigint (detected by field name convention)
 *   TypeSpec int32  → JSON Schema "type:integer" → number
 *   TypeSpec string → "type:string" → string
 *   TypeSpec boolean → "type:boolean" → boolean
 */
import * as yaml from "js-yaml"

const SCHEMAS_DIR = `${import.meta.dir}/../generated/@typespec/json-schema`
const OUT_DIR     = `${import.meta.dir}/../generated/ts/entities`

// ── Types ────────────────────────────────────────────────────────────────────

interface JsonSchema {
  $id?: string
  type?: string
  properties?: Record<string, JsonSchemaProp>
  required?: string[]
  description?: string
  "x-table"?: string
  "x-primary-key"?: string
  "x-unique"?: string[][]
  "x-indexes"?: string[][]
  "x-int64-fields"?: string[]
}

interface JsonSchemaProp {
  type?: string
  description?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  "x-int64"?: boolean
}

// ── Conventions ───────────────────────────────────────────────────────────────

function isInt64(name: string, prop: JsonSchemaProp, int64Fields: Set<string>): boolean {
  if (prop["x-int64"] === true) return true
  if (int64Fields.has(name)) return true
  return /At$|Tokens$|Ms$|Count$|Size$/.test(name)
}

function toTsType(prop: JsonSchemaProp, name: string, int64Fields: Set<string>): string {
  if (prop.type === "string")  return isInt64(name, prop, int64Fields) ? "bigint" : "string"
  if (prop.type === "integer") return "number"
  if (prop.type === "boolean") return "boolean"
  if (prop.type === "number")  return "number"
  return "unknown"
}

function toZod(prop: JsonSchemaProp, name: string, int64Fields: Set<string>): string {
  if (prop.type === "string") {
    if (isInt64(name, prop, int64Fields)) return "z.bigint()"
    let z = "z.string()"
    if (prop.minLength) z += `.min(${prop.minLength})`
    if (prop.maxLength) z += `.max(${prop.maxLength})`
    return z
  }
  if (prop.type === "integer") {
    let z = "z.number().int()"
    if (prop.minimum !== undefined && prop.minimum > -2_147_483_648) z += `.min(${prop.minimum})`
    if (prop.maximum !== undefined && prop.maximum < 2_147_483_647)  z += `.max(${prop.maximum})`
    return z
  }
  if (prop.type === "boolean") return "z.boolean()"
  if (prop.type === "number")  return "z.number()"
  return "z.unknown()"
}

function toSqlType(prop: JsonSchemaProp, name: string, int64Fields: Set<string>): string {
  if (prop.type === "string")  return isInt64(name, prop, int64Fields) ? "BIGINT NOT NULL" : "TEXT NOT NULL"
  if (prop.type === "integer") return "INTEGER NOT NULL"
  if (prop.type === "boolean") return "BOOLEAN NOT NULL"
  if (prop.type === "number")  return "DOUBLE PRECISION NOT NULL"
  return "TEXT NOT NULL"
}

function toSnake(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await Bun.write(`${OUT_DIR}/.keep`, "")  // ensure dir exists

  const glob = new Bun.Glob("*.yaml")
  const files = [...glob.scanSync(SCHEMAS_DIR)].sort()

  interface EntityMeta {
    name: string
    schema: JsonSchema
    table: string
    pk: string
    indexes: string[][]
    unique: string[][]
    int64Fields: Set<string>
  }

  const entities: EntityMeta[] = []

  for (const file of files) {
    const raw = await Bun.file(`${SCHEMAS_DIR}/${file}`).text()
    const schema = yaml.load(raw) as JsonSchema
    if (!schema["x-table"]) continue
    const name = file.replace(".yaml", "")
    function normalizeColGroups(raw: unknown): string[][] {
      if (!Array.isArray(raw)) return []
      if (raw.length === 0) return []
      if (Array.isArray(raw[0])) return raw as string[][]
      return [raw as string[]]
    }

    entities.push({
      name,
      schema,
      table: schema["x-table"]!,
      pk: schema["x-primary-key"] ?? "id",
      indexes: normalizeColGroups(schema["x-indexes"]),
      unique: normalizeColGroups(schema["x-unique"]),
      int64Fields: new Set(schema["x-int64-fields"] ?? []),
    })
  }

  if (entities.length === 0) {
    console.log("No entity schemas found (missing x-table annotation)")
    return
  }

  console.log(`Generating ${entities.length} entities: ${entities.map(e => e.name).join(", ")}`)

  // ── 1. Zod schemas ───────────────────────────────────────────────────────
  for (const { name, schema, pk, int64Fields } of entities) {
    const props   = schema.properties ?? {}
    const req     = new Set(schema.required ?? [])
    const allFields   = new Set(Object.keys(props))
    const omitCandidates = [pk, "createdAt", "updatedAt"].filter(Boolean) as string[]
    const omitSet     = omitCandidates.filter(f => allFields.has(f))

    const lines = [
      `// @generated by codegen-entities.ts — DO NOT EDIT`,
      `// source: TypeSpec entity ${name}`,
      `import { z } from "zod"`,
      ``,
      `export const ${name}Schema = z.object({`,
    ]

    for (const [field, prop] of Object.entries(props)) {
      const zodExpr = toZod(prop, field, int64Fields)
      const opt     = !req.has(field) ? ".optional()" : ""
      if (prop.description) lines.push(`  /** ${prop.description} */`)
      lines.push(`  ${field}: ${zodExpr}${opt},`)
    }

    lines.push(`})`)
    lines.push(`export type ${name} = z.infer<typeof ${name}Schema>`)
    lines.push(``)

    // Insert schema — omit pk + auto-set timestamps
    const omitObj = omitSet.map(k => `${k}: true`).join(", ")
    lines.push(`export const ${name}InsertSchema = ${name}Schema.omit({ ${omitObj} })`)
    lines.push(`export type ${name}Insert = z.infer<typeof ${name}InsertSchema>`)
    lines.push(``)

    // Update schema — all optional except id
    // Update schema: all optional, pk required (only if pk exists)
    if (pk && allFields.has(pk)) {
      lines.push(`export const ${name}UpdateSchema = ${name}Schema.partial().required({ ${pk}: true })`)
      lines.push(`export type ${name}Update = z.infer<typeof ${name}UpdateSchema>`)
    }
    lines.push(``)

    await Bun.write(`${OUT_DIR}/${name.toLowerCase()}-schema.ts`, lines.join("\n"))
    console.log(`  ✓ ${name.toLowerCase()}-schema.ts`)
  }

  // ── 2. Kysely Database interface ─────────────────────────────────────────
  const kyselyLines = [
    `// @generated by codegen-entities.ts — DO NOT EDIT`,
    ...entities.map(({ name }) => `import type { ${name} } from "./${name.toLowerCase()}-schema.js"`),
    ``,
    `/**`,
    ` * Kysely Database interface.`,
    ` * Types are z.infer<> from Zod schemas — single source of truth from TypeSpec.`,
    ` */`,
    `export interface Database {`,
    ...entities.map(({ name, table }) => `  ${table}: ${name}`),
    `}`,
    ``,
  ]
  await Bun.write(`${OUT_DIR}/kysely-database.ts`, kyselyLines.join("\n"))
  console.log(`  ✓ kysely-database.ts`)

  // ── 3. Migration SQL ──────────────────────────────────────────────────────
  const sqlLines = [
    `-- @generated by codegen-entities.ts — DO NOT EDIT`,
    `-- PostgreSQL DDL for all entity tables`,
    ``,
  ]

  for (const entity of entities) {
    const { schema, table, pk, indexes, unique, int64Fields } = entity
    const props   = schema.properties ?? {}

    sqlLines.push(`CREATE TABLE IF NOT EXISTS ${table} (`)

    const colDefs = Object.entries(props).map(([field, prop]) => {
      const col     = toSnake(field)
      const sqlType = toSqlType(prop, field, int64Fields)
      const isPk    = field === pk
      return `  ${col.padEnd(28)} ${sqlType}${isPk ? " PRIMARY KEY" : ""}`
    })
    sqlLines.push(colDefs.join(",\n"))
    sqlLines.push(`);`)
    sqlLines.push(``)

    for (const cols of unique) {
      const colNames = cols.map(toSnake).join(", ")
      const cName    = `${table}_${cols.map(toSnake).join("_")}_key`
      sqlLines.push(`ALTER TABLE IF EXISTS ${table}`)
      sqlLines.push(`  ADD CONSTRAINT IF NOT EXISTS ${cName} UNIQUE (${colNames});`)
      sqlLines.push(``)
    }

    for (const cols of indexes) {
      const colNames = cols.map(toSnake).join(", ")
      const iName    = `idx_${table}_${cols.map(toSnake).join("_")}`
      sqlLines.push(`CREATE INDEX IF NOT EXISTS ${iName} ON ${table} (${colNames});`)
    }

    sqlLines.push(``)
  }

  await Bun.write(`${OUT_DIR}/migrations.sql`, sqlLines.join("\n"))
  console.log(`  ✓ migrations.sql`)

  console.log(`\nAll files written to ${OUT_DIR}/`)
}

main().catch(e => { console.error(e); process.exit(1) })
