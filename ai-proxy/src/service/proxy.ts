import { okAsync, errAsync, ResultAsync } from "neverthrow"
import type { DB } from "../db/index.js"
import { dbQuery } from "../db/index.js"
import { NotFoundError, DbError } from "../errors.js"
import type { Proxy, ProxyInsert, ProxyUpdate } from "../entities/index.js"
import { randomId, nowSec, generateApiKey } from "./util.js"

type ProxyError = NotFoundError | DbError

export interface ProxyJoined extends Proxy {
  providerId:        string
  providerName:      string
  modelId:           string
  modelName:         string
  upstream:          string
  targetModel:       string
  supportStreaming:  boolean
  supportTools:      boolean
  supportVision:     boolean
  supportReasoning:  boolean
  defaultMaxTokens:  number
  contextLength:     number
  autoCompactLength: number
}

export function createProxyService(db: DB) {
  return {
    list(enabledOnly: boolean): ResultAsync<ProxyJoined[], DbError> {
      return dbQuery(() => {
        let q = db.selectFrom("ai_proxy_proxies")
          .innerJoin("ai_proxy_provider_model_configs", "ai_proxy_proxies.providerModelConfigId", "ai_proxy_provider_model_configs.id")
          .select([
            "ai_proxy_proxies.id as id",
            "ai_proxy_proxies.sourceModel",
            "ai_proxy_proxies.providerModelConfigId",
            "ai_proxy_proxies.apiKey as apiKey",
            "ai_proxy_proxies.enabled",
            "ai_proxy_proxies.createdAt",
            "ai_proxy_proxies.updatedAt",
            "ai_proxy_provider_model_configs.providerId",
            "ai_proxy_provider_model_configs.providerName",
            "ai_proxy_provider_model_configs.modelId",
            "ai_proxy_provider_model_configs.modelName",
            "ai_proxy_provider_model_configs.upstream",
            "ai_proxy_provider_model_configs.modelId as targetModel",
            "ai_proxy_provider_model_configs.supportStreaming",
            "ai_proxy_provider_model_configs.supportTools",
            "ai_proxy_provider_model_configs.supportVision",
            "ai_proxy_provider_model_configs.supportReasoning",
            "ai_proxy_provider_model_configs.defaultMaxTokens",
            "ai_proxy_provider_model_configs.contextLength",
            "ai_proxy_provider_model_configs.autoCompactLength",
          ]) as any
        if (enabledOnly) q = q.where("ai_proxy_proxies.enabled", "=", true)
        return q.execute()
      })
    },

    get(id: string): ResultAsync<ProxyJoined, ProxyError> {
      return dbQuery(() =>
        db.selectFrom("ai_proxy_proxies")
          .innerJoin("ai_proxy_provider_model_configs", "ai_proxy_proxies.providerModelConfigId", "ai_proxy_provider_model_configs.id")
          .select([
            "ai_proxy_proxies.id as id",
            "ai_proxy_proxies.sourceModel",
            "ai_proxy_proxies.providerModelConfigId",
            "ai_proxy_proxies.apiKey as apiKey",
            "ai_proxy_proxies.enabled",
            "ai_proxy_proxies.createdAt",
            "ai_proxy_proxies.updatedAt",
            "ai_proxy_provider_model_configs.providerId",
            "ai_proxy_provider_model_configs.providerName",
            "ai_proxy_provider_model_configs.modelId",
            "ai_proxy_provider_model_configs.modelName",
            "ai_proxy_provider_model_configs.upstream",
            "ai_proxy_provider_model_configs.modelId as targetModel",
            "ai_proxy_provider_model_configs.supportStreaming",
            "ai_proxy_provider_model_configs.supportTools",
            "ai_proxy_provider_model_configs.supportVision",
            "ai_proxy_provider_model_configs.supportReasoning",
            "ai_proxy_provider_model_configs.defaultMaxTokens",
            "ai_proxy_provider_model_configs.contextLength",
            "ai_proxy_provider_model_configs.autoCompactLength",
          ])
          .where("ai_proxy_proxies.id", "=", id)
          .executeTakeFirst()
      ).andThen(row =>
        row ? okAsync(row as ProxyJoined) : errAsync(new NotFoundError(`proxy not found: ${id}`))
      )
    },

    getByApiKey(apiKey: string, sourceModel: string): ResultAsync<ProxyJoined, ProxyError> {
      return dbQuery(() =>
        db.selectFrom("ai_proxy_proxies")
          .innerJoin("ai_proxy_provider_model_configs", "ai_proxy_proxies.providerModelConfigId", "ai_proxy_provider_model_configs.id")
          .selectAll()
          .where("ai_proxy_proxies.apiKey", "=", apiKey)
          .where("ai_proxy_proxies.sourceModel", "=", sourceModel)
          .where("ai_proxy_proxies.enabled", "=", true)
          .executeTakeFirst()
      ).andThen(row =>
        row ? okAsync(row as unknown as ProxyJoined) : errAsync(new NotFoundError(`no enabled proxy for model: ${sourceModel}`))
      )
    },

    getUpstreamKey(providerModelConfigId: string): ResultAsync<string, ProxyError> {
      return dbQuery(() =>
        db.selectFrom("ai_proxy_provider_model_configs")
          .select("apiKey")
          .where("id", "=", providerModelConfigId)
          .executeTakeFirst()
      ).andThen(row =>
        row ? okAsync(row.apiKey) : errAsync(new NotFoundError(`provider model config not found: ${providerModelConfigId}`))
      )
    },

    create(data: ProxyInsert): ResultAsync<Proxy, DbError> {
      const id  = randomId()
      const now = BigInt(nowSec())
      const apiKey = generateApiKey()
      return dbQuery(() =>
        db.insertInto("ai_proxy_proxies")
          .values({
            id,
            sourceModel: data.sourceModel,
            providerModelConfigId: data.providerModelConfigId,
            apiKey,
            enabled:   true,
            createdAt: now,
            updatedAt: now,
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      )
    },

    update(data: ProxyUpdate): ResultAsync<Proxy, ProxyError> {
      const { id, ...fields } = data
      const updates = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined)
      )
      return dbQuery(() =>
        db.updateTable("ai_proxy_proxies")
          .set({ ...updates, updatedAt: BigInt(nowSec()) })
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirst()
      ).andThen(row =>
        row ? okAsync(row) : errAsync(new NotFoundError(`proxy not found: ${id}`))
      )
    },

    delete(id: string): ResultAsync<void, DbError> {
      return dbQuery(() =>
        db.deleteFrom("ai_proxy_proxies").where("id", "=", id).execute()
      ).map(() => undefined)
    },

    listModels(): ResultAsync<string[], DbError> {
      return dbQuery(() =>
        db.selectFrom("ai_proxy_proxies")
          .select("sourceModel")
          .where("enabled", "=", true)
          .execute()
      ).map(rows => [...new Set(rows.map(r => r.sourceModel))])
    },
  }
}
