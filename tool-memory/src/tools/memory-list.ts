import type { ITool } from "@openzerg/tool-server-sdk"
import { getBucket, dbOp, type DB, ResultAsync, toAppError } from "./shared.js"

export function createMemoryList(db: DB): ITool {
  return {
    name: "memory-list",
    description: "List all keys in the agent's persistent memory.",
    group: "memory",
    priority: 10,
    dependencies: [],
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: { entries: { type: "array" } } },
    execute(_argsJson, sessionToken, getContext) {
      return ResultAsync.fromPromise(getContext(sessionToken), toAppError).andThen((ctx) => {
        const bucket = getBucket(ctx)
        return dbOp(() =>
          db.selectFrom("memory_entries").select(["key", "updated_at"])
            .where("bucket_name", "=", bucket).orderBy("updated_at", "desc").execute()
        ).map((rows) => ({ entries: rows.map(r => ({ key: r.key, updatedAt: Number(r.updated_at) })) }))
      })
    },
  }
}
