import { ResultAsync } from "neverthrow"
import { AppError, InternalError } from "@openzerg/common"
import { create } from "@bufbuild/protobuf"
import { mkdirSync, writeFileSync, openSync, closeSync, existsSync } from "node:fs"
import { join } from "node:path"
import { SpawnResponseSchema, type SpawnRequest, type SpawnResponse } from "@openzerg/common/gen/worker/v1_pb.js"

const PROFILE_DIR = process.env.NIX_PROFILE_DIR || "/opt/nix-profile"
const ENV_SH = (process.env.WORKER_STATE_DIR || "/tmp/openzerg-worker-state") + "/env.sh"

function wrapCommand(command: string): string {
  if (existsSync(ENV_SH)) {
    return `. ${ENV_SH} 2>/dev/null; ${command}`
  }
  return command
}

function buildCommand(req: SpawnRequest): string[] {
  const bwrap = process.env._BWRAP_BIN
  const cmd = wrapCommand(req.command)
  if (!bwrap) {
    return ["bash", "-c", cmd]
  }
  const workerStateDir = process.env.WORKER_STATE_DIR || "/tmp/openzerg-worker-state"
  return [
    bwrap,
    "--ro-bind", "/usr", "/usr",
    "--ro-bind-try", "/lib", "/lib",
    "--ro-bind-try", "/lib64", "/lib64",
    "--ro-bind", "/bin", "/bin",
    "--ro-bind", "/etc/ssl", "/etc/ssl",
    "--ro-bind", "/nix", "/nix",
    "--ro-bind-try", workerStateDir, workerStateDir,
    "--ro-bind-try", PROFILE_DIR, PROFILE_DIR,
    "--bind", "/data", "/data",
    "--dev", "/dev",
    "--proc", "/proc",
    "--tmpfs", "/tmp",
    "--unshare-net",
    "bash", "-c", cmd,
  ]
}

export function runSpawn(req: SpawnRequest, jobsDir: string): ResultAsync<SpawnResponse, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const jobDir = join(jobsDir, req.jobId)
      mkdirSync(jobDir, { recursive: true })

      const env = { ...process.env, ...Object.fromEntries(Object.entries(req.env)) }
      const stdoutFd = openSync(join(jobDir, "stdout"), "w")
      const stderrFd = openSync(join(jobDir, "stderr"), "w")

      const cmd = buildCommand(req)
      const proc = Bun.spawn(cmd, {
        cwd: req.workdir || undefined,
        env,
        stdout: stdoutFd,
        stderr: stderrFd,
        detached: true,
      })

      closeSync(stdoutFd)
      closeSync(stderrFd)
      writeFileSync(join(jobDir, "pid"), String(proc.pid))

      const exitCodePath = join(jobDir, "exitcode")
      proc.exited.then((code: number | null) => {
        writeFileSync(exitCodePath, String(code ?? 1))
      }).catch(() => {
        writeFileSync(exitCodePath, "1")
      })

      return create(SpawnResponseSchema, { started: true, error: "" })
    })(),
    (e) => new InternalError(e instanceof Error ? e.message : String(e)),
  ).orElse((err) => {
    return ResultAsync.fromSafePromise(
      Promise.resolve(create(SpawnResponseSchema, { started: false, error: err.message }))
    )
  })
}
