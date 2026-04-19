import type { ToolContext } from "@openzerg/tool-server-sdk"
import type { DB } from "../db.js"
import { ResultAsync, okAsync, errAsync } from "neverthrow"
import { AppError, ValidationError, NotFoundError, toAppError } from "@openzerg/common"
import { randomUUID } from "node:crypto"

export function getBucket(ctx: ToolContext): string {
  const memoryConfig = ctx.serverConfigs?.["tool-memory"]
  return memoryConfig?.bucketName ?? ctx.sessionId
}

export function dbOp<T>(fn: () => Promise<T>): ResultAsync<T, AppError> {
  return ResultAsync.fromPromise(fn(), toAppError)
}

export { ResultAsync, okAsync, errAsync }
export { AppError, NotFoundError, ValidationError, toAppError }
export { randomUUID }
export type { DB }
