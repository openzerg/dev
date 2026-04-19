import { ok, err, ResultAsync, type Result } from "neverthrow"
import { AppError, InternalError, ConflictError } from "@openzerg/common"
import { create } from "@bufbuild/protobuf"
import {
  ReadFileResponseSchema,
  WriteFileResponseSchema,
  StatResponseSchema,
  type ReadFileRequest,
  type WriteFileRequest,
  type StatRequest,
  type ReadFileResponse,
  type WriteFileResponse,
  type StatResponse,
} from "@openzerg/common/gen/worker/v1_pb.js"
import { readFile, writeFile, mkdir, stat as fsStat } from "node:fs/promises"
import { dirname } from "node:path"

const toErr = (e: unknown) => new InternalError(e instanceof Error ? e.message : String(e))

const NOT_EXISTS = create(StatResponseSchema, { exists: false, isFile: false, isDir: false, size: 0n, mtimeMs: 0n })

export function runReadFile(req: ReadFileRequest): ResultAsync<ReadFileResponse, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const content = await readFile(req.path)
      const st = await fsStat(req.path)
      return create(ReadFileResponseSchema, {
        content: new Uint8Array(content),
        mtimeMs: BigInt(st.mtimeMs),
      })
    })(),
    toErr,
  )
}

export function runWriteFile(req: WriteFileRequest): ResultAsync<WriteFileResponse, AppError> {
  return new ResultAsync((async (): Promise<Result<WriteFileResponse, AppError>> => {
    if (req.expectedMtimeMs !== 0n) {
      const stR = await ResultAsync.fromPromise(fsStat(req.path), () => undefined)
      if (stR.isOk()) {
        const currentMtime = BigInt(Math.floor(stR.value.mtimeMs))
        const tolerance = 50n
        const diff = currentMtime > req.expectedMtimeMs
          ? currentMtime - req.expectedMtimeMs
          : req.expectedMtimeMs - currentMtime
        if (diff > tolerance) {
          return err(new ConflictError(
            `File "${req.path}" was modified externally (expected mtime=${req.expectedMtimeMs}, actual=${currentMtime})`,
          ))
        }
      }
    }

    const mkdirR = await ResultAsync.fromPromise(mkdir(dirname(req.path), { recursive: true }), toErr)
    if (mkdirR.isErr()) return err(mkdirR.error)

    const writeR = await ResultAsync.fromPromise(writeFile(req.path, req.content), toErr)
    if (writeR.isErr()) return err(writeR.error)

    const newStR = await ResultAsync.fromPromise(fsStat(req.path), toErr)
    if (newStR.isErr()) return err(newStR.error)
    return ok(create(WriteFileResponseSchema, {
      actualMtimeMs: BigInt(Math.floor(newStR.value.mtimeMs)),
    }))
  })())
}

export function runStat(req: StatRequest): ResultAsync<StatResponse, AppError> {
  return ResultAsync.fromPromise(fsStat(req.path), toErr)
    .map((st) => create(StatResponseSchema, {
      exists: true,
      isFile: st.isFile(),
      isDir: st.isDirectory(),
      size: BigInt(st.size),
      mtimeMs: BigInt(Math.floor(st.mtimeMs)),
    }))
    .orElse(() => ok(NOT_EXISTS))
}
