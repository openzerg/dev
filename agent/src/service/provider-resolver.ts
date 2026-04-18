import type { DB } from "../db/index.js"
import type { AiProxyClient } from "@openzerg/common"
import type { AppError } from "@openzerg/common"
import { ResultAsync, errAsync } from "neverthrow"
import { NotFoundError, ValidationError } from "@openzerg/common"

const MAX_TOOL_ITERATIONS = 50

export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  contextLength: number
  autoCompactLength: number
}

export interface RoleConfig {
  systemPrompt: string
  maxSteps: number
  zcpServers: string
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
      this.db.selectFrom("registry_sessions").select(["roleId"])
        .where("id", "=", sessionId).executeTakeFirst(),
      () => new ValidationError("Failed to query session"),
    ).andThen(session => {
      if (!session?.roleId) return errAsync(new ValidationError("Session has no role"))
      return ResultAsync.fromPromise(
        this.db.selectFrom("registry_roles").selectAll()
          .where("id", "=", session.roleId).executeTakeFirst(),
        () => new ValidationError("Failed to query role"),
      ).andThen(role => {
        if (!role) return errAsync(new NotFoundError("Role not found"))
        if (!role.aiProxyId) return errAsync(new ValidationError("Role has no provider configured"))
        return this.resolveFromProxy(role.aiProxyId)
      })
    })
  }

  private resolveFromProxy(aiProxyId: string): ResultAsync<ProviderConfig, AppError> {
    if (this.aiProxyClient) {
      return ResultAsync.fromPromise(
        this.aiProxyClient.getProxy(aiProxyId),
        () => new NotFoundError(`AI Proxy not found: ${aiProxyId}`),
      ).map(proxy => ({
        baseUrl: proxy.upstream,
        apiKey: proxy.apiKey,
        model: proxy.targetModel,
        maxTokens: proxy.defaultMaxTokens || 4096,
        contextLength: proxy.contextLength || 0,
        autoCompactLength: proxy.autoCompactLength || 0,
      }))
    }

    return ResultAsync.fromPromise(
      this.db.selectFrom("ai_proxy_proxies").selectAll()
        .where("id", "=", aiProxyId).executeTakeFirst(),
      () => new NotFoundError(`AI Proxy not found: ${aiProxyId}`),
    ).andThen(proxy => {
      if (!proxy) return errAsync(new NotFoundError(`AI Proxy not found: ${aiProxyId}`))
      return ResultAsync.fromPromise(
        this.db.selectFrom("ai_proxy_provider_model_configs").selectAll()
          .where("id", "=", proxy.providerModelConfigId).executeTakeFirst(),
        () => new NotFoundError(`Provider config not found: ${proxy.providerModelConfigId}`),
      ).andThen(config => {
        if (!config) return errAsync(new NotFoundError(`Provider config not found: ${proxy.providerModelConfigId}`))
        return ResultAsync.fromSafePromise(Promise.resolve({
          baseUrl: config.upstream,
          apiKey: config.apiKey,
          model: config.modelId,
          maxTokens: config.defaultMaxTokens || 4096,
          contextLength: config.contextLength || 0,
          autoCompactLength: config.autoCompactLength || 0,
        }))
      })
    })
  }

  loadRole(sessionId: string): ResultAsync<RoleConfig, AppError> {
    return ResultAsync.fromPromise(
      this.db.selectFrom("registry_sessions").select(["roleId"])
        .where("id", "=", sessionId).executeTakeFirst(),
      () => new ValidationError("Failed to query session"),
    ).andThen(session => {
      if (!session?.roleId) {
        return ResultAsync.fromSafePromise(Promise.resolve({
          systemPrompt: "", maxSteps: MAX_TOOL_ITERATIONS, zcpServers: "[]", skills: "[]", extraPkgs: "[]",
        }))
      }
      return ResultAsync.fromPromise(
        this.db.selectFrom("registry_roles").selectAll()
          .where("id", "=", session.roleId).executeTakeFirst(),
        () => new ValidationError("Failed to query role"),
      ).map(role => role
        ? { systemPrompt: role.systemPrompt, maxSteps: role.maxSteps, zcpServers: role.zcpServers, skills: role.skills, extraPkgs: role.extraPkgs }
        : { systemPrompt: "", maxSteps: MAX_TOOL_ITERATIONS, zcpServers: "[]", skills: "[]", extraPkgs: "[]" },
      )
    })
  }

  loadRoleById(roleId: string): ResultAsync<RoleConfig | null, AppError> {
    return ResultAsync.fromPromise(
      this.db.selectFrom("registry_roles").selectAll()
        .where("id", "=", roleId).executeTakeFirst(),
      () => new ValidationError("Failed to query role"),
    ).map(role => {
      if (!role) return null
      return { systemPrompt: role.systemPrompt, maxSteps: role.maxSteps, zcpServers: role.zcpServers, skills: role.skills, extraPkgs: role.extraPkgs }
    })
  }
}
