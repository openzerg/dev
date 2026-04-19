import { ConnectError, Code } from "@connectrpc/connect"
import { ResultAsync, type Result } from "neverthrow"
import type { AppError } from "@openzerg/common"
import {
  WorkerService,
  type ExecRequest,
  type ExecResponse,
  type SpawnRequest,
  type SpawnResponse,
  type ReadFileRequest,
  type ReadFileResponse,
  type WriteFileRequest,
  type WriteFileResponse,
  type StatRequest,
  type StatResponse,
} from "@openzerg/common/gen/worker/v1_pb.js"
import { create } from "@bufbuild/protobuf"
import { InstallPackagesResponseSchema } from "@openzerg/common/gen/worker/v1_pb.js"
import type { ConnectRouter, Interceptor } from "@connectrpc/connect"
import { runExec } from "./exec.js"
import { runSpawn } from "./spawn.js"
import { runReadFile, runWriteFile, runStat } from "./fs.js"
import { ensurePackages, getEnvShPath } from "./nix-manager.js"

function workerSecret(): string {
  return process.env.WORKER_SECRET ?? ""
}

const JOBS_DIR = process.env.JOBS_DIR ?? "/tmp/worker-jobs"

function unwrap<T>(result: ResultAsync<T, AppError>): Promise<T> {
  return result.mapErr((e: AppError) => new ConnectError(e.message, Code.Internal)).match(
    (ok: T) => ok,
    (err: ConnectError) => { throw err },
  )
}

export function createWorkerRouter(): (router: ConnectRouter) => void {
  return (router: ConnectRouter) => {
    router.service(WorkerService, {
      exec(req: ExecRequest): Promise<ExecResponse> {
        return unwrap(runExec(req))
      },
      spawn(req: SpawnRequest): Promise<SpawnResponse> {
        return unwrap(runSpawn(req, JOBS_DIR))
      },
      readFile(req: ReadFileRequest): Promise<ReadFileResponse> {
        return unwrap(runReadFile(req))
      },
      writeFile(req: WriteFileRequest): Promise<WriteFileResponse> {
        return unwrap(runWriteFile(req))
      },
      stat(req: StatRequest): Promise<StatResponse> {
        return unwrap(runStat(req))
      },
      async installPackages(req) {
        const result = await ensurePackages([...req.packages])
        if (result.isErr()) throw new ConnectError(result.error.message, Code.Internal)
        return create(InstallPackagesResponseSchema, {
          installed: result.value.installed,
          failed: result.value.failed,
          envShPath: getEnvShPath(),
        })
      },
      health() {
        return Promise.resolve({ status: "ok" })
      },
    })
  }
}

export function authInterceptor(): Interceptor {
  return (next) => async (req) => {
    const secret = workerSecret()
    if (!secret) return next(req)
    const auth = req.header.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      throw new ConnectError("Unauthorized", Code.Unauthenticated)
    }
    return next(req)
  }
}
