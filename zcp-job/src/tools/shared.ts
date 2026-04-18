import type { ToolContext } from "@openzerg/zcp"
export { parseArgs } from "@openzerg/zcp"
import { WorkerClient, AppError, UpstreamError, toAppError } from "@openzerg/common"
import { Result, ResultAsync, ok, err } from "neverthrow"

export const JOBS_DIR = "/tmp/worker-jobs"

export class WorkerSession {
  private client: WorkerClient
  private workdir: string

  constructor(ctx: ToolContext) {
    this.client = new WorkerClient({ baseURL: ctx.workerUrl, token: ctx.workerSecret })
    this.workdir = ctx.workspaceRoot
  }

  exec(command: string, workdir?: string): ResultAsync<string, AppError> {
    return new ResultAsync((async (): Promise<Result<string, AppError>> => {
      const result = await this.client.exec({ command, workdir: workdir ?? this.workdir })
      if (result.isErr()) return err(toAppError(result.error))
      const resp = result.value
      if (resp.exitCode !== 0) {
        return err(new UpstreamError(new TextDecoder().decode(resp.stderr)))
      }
      return ok(new TextDecoder().decode(resp.stdout))
    })())
  }

  spawn(jobId: string, command: string, workdir?: string): ResultAsync<void, AppError> {
    return new ResultAsync((async (): Promise<Result<void, AppError>> => {
      const result = await this.client.spawn({ jobId, command, workdir: workdir ?? this.workdir })
      if (result.isErr()) return err(toAppError(result.error))
      const resp = result.value
      if (!resp.started) {
        return err(new UpstreamError(resp.error || "Failed to spawn job"))
      }
      return ok(undefined)
    })())
  }

  readFile(path: string): ResultAsync<string, AppError> {
    return new ResultAsync((async (): Promise<Result<string, AppError>> => {
      const result = await this.client.readFile(path)
      if (result.isErr()) return err(toAppError(result.error))
      return ok(new TextDecoder().decode(result.value.content))
    })())
  }

  stat(path: string): ResultAsync<{ exists: boolean; size: bigint }, AppError> {
    return new ResultAsync((async (): Promise<Result<{ exists: boolean; size: bigint }, AppError>> => {
      const result = await this.client.stat(path)
      if (result.isErr()) return err(toAppError(result.error))
      return ok({ exists: result.value.exists, size: result.value.size })
    })())
  }

  writeFile(path: string, content: string): ResultAsync<void, AppError> {
    return new ResultAsync((async (): Promise<Result<void, AppError>> => {
      const bytes = new TextEncoder().encode(content)
      const result = await this.client.writeFile({ path, content: bytes })
      if (result.isErr()) return err(toAppError(result.error))
      return ok(undefined)
    })())
  }

  jobDir(jobId: string): string {
    return `${JOBS_DIR}/${jobId}`
  }

  readJobFile(jobId: string, filename: string): ResultAsync<string | null, AppError> {
    return new ResultAsync((async (): Promise<Result<string | null, AppError>> => {
      const path = `${this.jobDir(jobId)}/${filename}`
      const infoResult = await this.stat(path)
      if (infoResult.isErr()) return err(infoResult.error)
      if (!infoResult.value.exists) return ok(null)
      return await this.readFile(path)
    })())
  }

  isJobRunning(jobId: string): ResultAsync<boolean, AppError> {
    return new ResultAsync((async (): Promise<Result<boolean, AppError>> => {
      const exitCodeResult = await this.readJobFile(jobId, "exitcode")
      if (exitCodeResult.isErr()) return err(exitCodeResult.error)
      return ok(exitCodeResult.value === null)
    })())
  }

  getJobExitCode(jobId: string): ResultAsync<number | null, AppError> {
    return new ResultAsync((async (): Promise<Result<number | null, AppError>> => {
      const exitCodeResult = await this.readJobFile(jobId, "exitcode")
      if (exitCodeResult.isErr()) return err(exitCodeResult.error)
      if (exitCodeResult.value === null) return ok(null)
      return ok(parseInt(exitCodeResult.value.trim(), 10))
    })())
  }
}
