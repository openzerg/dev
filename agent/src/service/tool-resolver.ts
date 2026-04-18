import { ResultAsync, Result } from "neverthrow"
import { toAppError, type AppError } from "@openzerg/common"
import type { DB } from "../db/index.js"

export interface ResolvedZcpServer {
  name: string
  url: string
  serviceToken: string
}

function safeJsonParse(raw: string): Result<unknown, AppError> {
  return Result.fromThrowable(() => JSON.parse(raw), toAppError)()
}

export class ToolResolver {
  constructor(private db: DB) {}

  resolveServers(sessionId: string): ResultAsync<ResolvedZcpServer[], AppError> {
    return ResultAsync.fromPromise(
      this.db.selectFrom("registry_sessions").select(["roleId"])
        .where("id", "=", sessionId).executeTakeFirst(),
      toAppError,
    ).andThen(session => {
      if (!session?.roleId) return ResultAsync.fromSafePromise(Promise.resolve([]))
      return ResultAsync.fromPromise(
        this.db.selectFrom("registry_roles").select(["zcpServers"])
          .where("id", "=", session.roleId).executeTakeFirst(),
        toAppError,
      ).andThen(role => {
        if (!role?.zcpServers) return ResultAsync.fromSafePromise(Promise.resolve([]))
        const parsed = safeJsonParse(role.zcpServers)
        if (parsed.isErr()) return ResultAsync.fromSafePromise(Promise.resolve([]))
        const arr = parsed.value
        if (!Array.isArray(arr)) return ResultAsync.fromSafePromise(Promise.resolve([]))
        const serverTypes = arr
          .map((p: unknown) => typeof p === "string" ? p : (p as Record<string, unknown>).type)
          .filter(Boolean) as string[]
        if (serverTypes.length === 0) return ResultAsync.fromSafePromise(Promise.resolve([]))

        return ResultAsync.fromPromise(
          this.db.selectFrom("registry_instances").selectAll()
            .where("instanceType", "in", serverTypes)
            .where("lifecycle", "=", "active")
            .execute(),
          toAppError,
        ).map(instances => {
          const seen = new Set<string>()
          const result: ResolvedZcpServer[] = []
          for (const inst of instances) {
            if (seen.has(inst.instanceType)) continue
            seen.add(inst.instanceType)
            result.push({
              name: inst.instanceType,
              url: inst.publicUrl,
              serviceToken: (inst.metadata as string) ?? "{}",
            })
          }
          return result
        })
      })
    })
  }

  getSessionToken(sessionId: string): ResultAsync<string, AppError> {
    return ResultAsync.fromPromise(
      this.db.selectFrom("registry_sessions").select(["sessionToken"])
        .where("id", "=", sessionId).executeTakeFirst(),
      toAppError,
    ).map(session => session?.sessionToken ?? "")
  }
}
