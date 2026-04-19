import type { ITool } from "@openzerg/tool-server-sdk"
import { parseArgs } from "@openzerg/tool-server-sdk"
import { z } from "zod"
import { getBucket, dbOp, errAsync, okAsync, type DB, NotFoundError, ResultAsync, toAppError } from "./shared.js"

const Args = z.object({ key: z.string() })

export function createMemoryRead(db: DB): ITool {
  return {
    name: "memory-read",
    description: "Read a value from the agent's persistent memory by key.",
    group: "memory",
    priority: 10,
    dependencies: [],
    inputSchema: {
      type: "object",
      properties: { key: { type: "string", description: "Memory key to read" } },
      required: ["key"],
    },
    outputSchema: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } } },
    execute(argsJson, sessionToken, getContext) {
      return parseArgs(Args, argsJson).asyncAndThen((args) => {
        return ResultAsync.fromPromise(getContext(sessionToken), toAppError).andThen((ctx) => {
          const bucket = getBucket(ctx)
          return dbOp(() =>
            db.selectFrom("memory_entries").selectAll()
              .where("bucket_name", "=", bucket).where("key", "=", args.key)
              .executeTakeFirst()
          ).andThen((row) => {
            if (!row) return errAsync(new NotFoundError(`Memory key not found: ${args.key}`))
            return okAsync({ key: row.key, value: row.value })
          })
        })
      })
    },
  }
}
