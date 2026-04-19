import { ResultAsync } from "neverthrow"
import { AppError, InternalError } from "@openzerg/common"
import { create } from "@bufbuild/protobuf"
import { ExecResponseSchema, type ExecRequest, type ExecResponse } from "@openzerg/common/gen/worker/v1_pb.js"
import { existsSync } from "node:fs"

const PROFILE_DIR = process.env.NIX_PROFILE_DIR || "/opt/nix-profile"
const ENV_SH = (process.env.WORKER_STATE_DIR || "/tmp/openzerg-worker-state") + "/env.sh"

function wrapCommand(command: string): string {
  if (existsSync(ENV_SH)) {
    return `. ${ENV_SH} 2>/dev/null; ${command}`
  }
  return command
}

function buildCommand(req: ExecRequest): string[] {
  const bwrap = process.env._BWRAP_BIN
  const cmd = wrapCommand(req.command)
  if (!bwrap) {
    return ["bash", "-c", cmd]
  }
  const workerStateDir = process.env.WORKER_STATE_DIR || "/tmp/openzerg-worker-state"
  const args: string[] = [
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
  return args
}

export function runExec(req: ExecRequest): ResultAsync<ExecResponse, AppError> {
  const timeout = req.timeoutMs > 0 ? req.timeoutMs : undefined

  return ResultAsync.fromPromise(
    (async () => {
      const cmd = buildCommand(req)
      const proc = Bun.spawn(cmd, {
        cwd: req.workdir || undefined,
        env: { ...process.env, ...Object.fromEntries(Object.entries(req.env)) },
        stdout: "pipe",
        stderr: "pipe",
      })

      let timedOut = false
      if (timeout) {
        const timer = setTimeout(() => { timedOut = true; proc.kill("SIGKILL") }, timeout)
        await proc.exited
        clearTimeout(timer)
      } else {
        await proc.exited
      }

      const stdout = await new Response(proc.stdout).arrayBuffer()
      const stderr = await new Response(proc.stderr).arrayBuffer()

      return create(ExecResponseSchema, {
        exitCode: timedOut ? -1 : proc.exitCode ?? 1,
        stdout: new Uint8Array(stdout),
        stderr: new Uint8Array(stderr),
        timedOut,
      })
    })(),
    (e) => new InternalError(e instanceof Error ? e.message : String(e)),
  )
}
