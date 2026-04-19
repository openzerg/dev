import type { ResultAsync } from "neverthrow"
import type { AppError } from "@openzerg/common"
import { ok, err, Result, type Result as ResultType } from "neverthrow"
import { ValidationError } from "@openzerg/common"
import { z } from "zod"

export interface ToolContext {
  sessionId: string
  workerUrl: string
  workerSecret: string
  workspaceRoot: string
  serverConfigs: Record<string, Record<string, string>>
}

export type GetContext = (sessionToken: string) => Promise<ToolContext>

export interface ITool {
  name: string
  description: string
  group: string
  priority: number
  dependencies?: string[]
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  pkgs?: string[]
  systemContext?(): string | Promise<string>
  execute(argsJson: string, sessionToken: string, getContext: GetContext): ResultAsync<unknown, AppError>
}

const safeJsonParse = Result.fromThrowable(
  (s: string) => JSON.parse(s) as unknown,
  (e) => new ValidationError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`),
)

export function parseArgs<T>(schema: z.ZodType<T>, argsJson: string): Result<T, AppError> {
  const jsonR = safeJsonParse(argsJson)
  if (jsonR.isErr()) return err(jsonR.error)
  const parsed = schema.safeParse(jsonR.value)
  if (!parsed.success) return err(new ValidationError(parsed.error.message))
  return ok(parsed.data)
}

export interface ToolFactory<SvcCtx = void> {
  create(ctx: SvcCtx): ITool[]
}

export type { ResultAsync } from "neverthrow"
export type { AppError } from "@openzerg/common"
