import { ConnectError, Code } from "@connectrpc/connect"
import { ResultAsync } from "neverthrow"
import { DbError, type AppError } from "@openzerg/common"
import { randomUUID } from "node:crypto"

export function dbQuery<T>(fn: () => Promise<T>): ResultAsync<T, AppError> {
  return ResultAsync.fromPromise(fn(), (e) => new DbError(e instanceof Error ? e.message : String(e)))
}

export function unwrap<T>(result: ResultAsync<T, AppError>): Promise<T> {
  return result.mapErr((e: AppError) => new ConnectError(e.message, Code.Internal)).match(
    (ok: T) => ok,
    (err: ConnectError) => { throw err },
  )
}

export function now(): bigint {
  return BigInt(Date.now())
}

export { randomUUID }
