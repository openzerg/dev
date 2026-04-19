import type { DB } from "../db/index.js"
import type { AiProxyClient } from "@openzerg/common"
import type { AppError } from "@openzerg/common"
import { ResultAsync, errAsync } from "neverthrow"
import { NotFoundError, ValidationError } from "@openzerg/common"

export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  contextLength: number
  autoCompactLength: number
}

export interface SessionConfig {
  systemPrompt: string
  toolServers: string
  skills: string
  extraPkgs: string
}

export class ProviderResolver {
  constructor(
    private db: DB,
    private aiProxyClient: AiProxyClient | null,
  ) {}

  resolveProvider(sessionId: string): ResultAsync<ProviderConfig, AppError> {
    return ResultAsync.fromPromise(
      this.db.selectFrom("registry_sessions").selectAll()
        .where("id", "=", sessionId).executeTakeFirst(),
      () => new ValidationError("Failed to query session"),
    ).andThen(session => {
      if (!session) return errAsync(new NotFoundError("Session not found"))

      if (session.upstream && session.apiKey && session.modelId) {
        return ResultAsync.fromSafePromise(Promise.resolve({
          baseUrl: session.upstream,
          apiKey: session.apiKey,
          model: session.modelId,
          maxTokens: session.maxTokens || 4096,
          contextLength: session.contextLength || 0,
          autoCompactLength: session.autoCompactLength || 0,
        }))
      }

      return errAsync(new ValidationError("Session has no provider configured"))
    })
  }

  loadSessionConfig(sessionId: string): ResultAsync<SessionConfig, AppError> {
    return ResultAsync.fromPromise(
      this.db.selectFrom("registry_sessions").selectAll()
        .where("id", "=", sessionId).executeTakeFirst(),
      () => new ValidationError("Failed to query session"),
    ).map(session => {
      if (!session) return { systemPrompt: "", toolServers: "[]", skills: "[]", extraPkgs: "[]" }
      return {
        systemPrompt: session.systemPrompt,
        toolServers: session.toolServers,
        skills: session.skills,
        extraPkgs: session.extraPkgs,
      }
    })
  }
}
