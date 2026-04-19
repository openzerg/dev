import type { ITool } from "@openzerg/tool-server-sdk"
import { parseArgs } from "@openzerg/tool-server-sdk"
import { z } from "zod"
import { getBucket, dbOp, errAsync, okAsync, randomUUID, type DB, ResultAsync, toAppError } from "./shared.js"

const Args = z.object({ key: z.string(), value: z.string() })

export function createMemorySave(db: DB): ITool {
  return {
    name: "memory-save",
    description: "Save a key-value pair to the agent's persistent memory. Overwrites existing value for the same key.",
    group: "memory",
    priority: 10,
    dependencies: [],
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Memory key" },
        value: { type: "string", description: "Memory value (any string content)" },
      },
      required: ["key", "value"],
    },
    outputSchema: { type: "object", properties: { success: { type: "boolean" } } },
    execute(argsJson, sessionToken, getContext) {
      return parseArgs(Args, argsJson).asyncAndThen((args) => {
        return ResultAsync.fromPromise(getContext(sessionToken), toAppError).andThen((ctx) => {
          const bucket = getBucket(ctx)
          const now = BigInt(Date.now())
          return dbOp(() =>
            db.selectFrom("memory_entries").selectAll()
              .where("bucket_name", "=", bucket).where("key", "=", args.key)
              .executeTakeFirst()
          ).andThen((existing) => {
            if (existing) {
              return dbOp(() =>
                db.updateTable("memory_entries").set({ value: args.value, updated_at: now })
                  .where("id", "=", existing.id).execute()
              )
            }
            return dbOp(() =>
              db.insertInto("memory_entries").values({
                id: randomUUID(), bucket_name: bucket, key: args.key,
                value: args.value, created_at: now, updated_at: now,
              }).execute()
            )
          }).map(() => ({ success: true }))
        })
      })
    },
  }
}
