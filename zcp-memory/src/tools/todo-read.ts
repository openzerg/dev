import type { IZcpTool } from "@openzerg/zcp"
import { dbOp, type DB, ResultAsync, toAppError } from "./shared.js"

export function createTodoRead(db: DB): IZcpTool {
  return {
    name: "todo-read",
    description: "Read the current session task list.",
    group: "todo",
    priority: 10,
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: { todos: { type: "array" } } },
    execute(_argsJson, sessionToken, getContext) {
      return ResultAsync.fromPromise(getContext(sessionToken), toAppError).andThen((ctx) => {
        const sessionId = ctx.sessionId
        return dbOp(() =>
          db.selectFrom("todo_entries").selectAll()
            .where("session_id", "=", sessionId).orderBy("position", "asc").execute()
        ).map((rows) => ({
          todos: rows.map((r) => ({
            content: r.content,
            status: r.status,
            priority: r.priority,
          })),
        }))
      })
    },
  }
}
