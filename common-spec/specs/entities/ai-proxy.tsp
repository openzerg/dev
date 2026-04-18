import "@typespec/json-schema";
using TypeSpec.JsonSchema;

/**
 * AI Proxy 实体定义
 */
@jsonSchema
namespace AiProxyEntities {

  @extension("x-table", "ai_proxy_provider_model_configs")
  @extension("x-primary-key", "id")
  @extension("x-indexes", #[
    #["providerId"],
    #["enabled"]
  ])
  model ProviderModelConfig {
    id: string;
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
    upstream: string;
    apiKey: string;
    supportStreaming:  boolean;
    supportTools:      boolean;
    supportVision:     boolean;
    supportReasoning:  boolean;
    defaultMaxTokens:  int32;
    contextLength:     int32;
    autoCompactLength: int32;
    enabled:           boolean;
    createdAt: int64;
    updatedAt: int64;
  }

  @extension("x-table", "ai_proxy_proxies")
  @extension("x-primary-key", "id")
  @extension("x-unique", #["sourceModel"])
  @extension("x-indexes", #[
    #["enabled"]
  ])
  model Proxy {
    id: string;
    @minLength(1)
    sourceModel: string;
    providerModelConfigId: string;
    apiKey: string;
    enabled: boolean;
    createdAt: int64;
    updatedAt: int64;
  }

  @extension("x-table", "ai_proxy_logs")
  @extension("x-primary-key", "id")
  @extension("x-indexes", #[
    #["proxyId"],
    #["createdAt"]
  ])
  model Log {
    id:                 string;
    proxyId:            string;
    sourceModel:        string;
    targetModel:        string;
    upstream:           string;
    inputTokens:        int64;
    outputTokens:       int64;
    totalTokens:        int64;
    durationMs:         int64;
    timeToFirstTokenMs: int64;
    isStream:           boolean;
    isSuccess:          boolean;
    errorMessage:       string;
    createdAt:          int64;
  }
}
