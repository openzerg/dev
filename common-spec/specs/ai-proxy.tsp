import "@typespec/protobuf";

using Protobuf;

/**
 * AiProxyService — LLM 代理服务
 */
@package({ name: "ai_proxy.v1" })
namespace AiProxyV1 {

  @Protobuf.service
  interface AiProxyService {
    listProxies(...ListProxiesRequest): ListProxiesResponse;
    getProxy(...GetProxyRequest): ProxyInfo;
    createProxy(...CreateProxyRequest): ProxyInfo;
    updateProxy(...UpdateProxyRequest): ProxyInfo;
    deleteProxy(...DeleteProxyRequest): DeleteProxyResponse;

    listProviderModelConfigs(...ListProviderModelConfigsRequest): ListProviderModelConfigsResponse;
    getProviderModelConfig(...GetProviderModelConfigRequest): ProviderModelConfigInfo;
    createProviderModelConfig(...CreateProviderModelConfigRequest): ProviderModelConfigInfo;
    updateProviderModelConfig(...UpdateProviderModelConfigRequest): ProviderModelConfigInfo;
    deleteProviderModelConfig(...DeleteProviderModelConfigRequest): DeleteProviderModelConfigResponse;

    listProviders(...ListProvidersRequest): ListProvidersResponse;
    listProviderModels(...ListProviderModelsRequest): ListProviderModelsResponse;

    testProviderModelConfig(...TestProviderModelConfigRequest): TestProviderModelConfigResponse;
    testProxy(...TestProxyRequest): TestProxyResponse;

    queryLogs(...QueryLogsRequest): QueryLogsResponse;
    getTokenStats(...GetTokenStatsRequest): TokenStatsResponse;
  }

  @message model ProxyInfo {
    @field(1)  id:                     string;
    @field(2)  sourceModel:            string;
    @field(3)  providerModelConfigId:  string;
    @field(4)  apiKey:                 string;
    @field(5)  enabled:                boolean;
    @field(6)  createdAt:              int64;
    @field(7)  updatedAt:              int64;
    @field(8)  providerId:             string;
    @field(9)  providerName:           string;
    @field(10) modelId:                string;
    @field(11) modelName:              string;
    @field(12) upstream:               string;
    @field(13) targetModel:            string;
    @field(14) supportStreaming:       boolean;
    @field(15) supportTools:           boolean;
    @field(16) supportVision:          boolean;
    @field(17) supportReasoning:       boolean;
    @field(18) defaultMaxTokens:       int32;
    @field(19) contextLength:          int32;
    @field(20) autoCompactLength:      int32;
  }

  @message model ListProxiesRequest {
    @field(1) enabledOnly: boolean;
  }
  @message model ListProxiesResponse {
    @field(1) proxies: ProxyInfo[];
  }
  @message model GetProxyRequest {
    @field(1) id: string;
  }
  @message model CreateProxyRequest {
    @field(1) sourceModel:            string;
    @field(2) providerModelConfigId:  string;
  }
  @message model UpdateProxyRequest {
    @field(1) id:                     string;
    @field(2) sourceModel:            string;
    @field(3) providerModelConfigId:  string;
    @field(4) enabled:                boolean;
  }
  @message model DeleteProxyRequest {
    @field(1) id: string;
  }
  @message model DeleteProxyResponse {}

  @message model ProviderModelConfigInfo {
    @field(1)  id:                string;
    @field(2)  providerId:        string;
    @field(3)  providerName:      string;
    @field(4)  modelId:           string;
    @field(5)  modelName:         string;
    @field(6)  upstream:          string;
    @field(7)  apiKey:            string;
    @field(8)  supportStreaming:  boolean;
    @field(9)  supportTools:      boolean;
    @field(10) supportVision:     boolean;
    @field(11) supportReasoning:  boolean;
    @field(12) defaultMaxTokens:  int32;
    @field(13) contextLength:     int32;
    @field(14) autoCompactLength: int32;
    @field(15) enabled:           boolean;
    @field(16) createdAt:         int64;
    @field(17) updatedAt:         int64;
  }

  @message model ListProviderModelConfigsRequest {
    @field(1) enabledOnly: boolean;
  }
  @message model ListProviderModelConfigsResponse {
    @field(1) configs: ProviderModelConfigInfo[];
  }
  @message model GetProviderModelConfigRequest {
    @field(1) id: string;
  }
  @message model CreateProviderModelConfigRequest {
    @field(1)  providerId:        string;
    @field(2)  providerName:      string;
    @field(3)  modelId:           string;
    @field(4)  modelName:         string;
    @field(5)  upstream:          string;
    @field(6)  apiKey:            string;
    @field(7)  supportStreaming:  boolean;
    @field(8)  supportTools:      boolean;
    @field(9)  supportVision:     boolean;
    @field(10) supportReasoning:  boolean;
    @field(11) defaultMaxTokens:  int32;
    @field(12) contextLength:     int32;
    @field(13) autoCompactLength: int32;
  }
  @message model UpdateProviderModelConfigRequest {
    @field(1)  id:                string;
    @field(2)  providerName:      string;
    @field(3)  modelName:         string;
    @field(4)  upstream:          string;
    @field(5)  apiKey:            string;
    @field(6)  supportStreaming:  boolean;
    @field(7)  supportTools:      boolean;
    @field(8)  supportVision:     boolean;
    @field(9)  supportReasoning:  boolean;
    @field(10) defaultMaxTokens:  int32;
    @field(11) contextLength:     int32;
    @field(12) autoCompactLength: int32;
    @field(13) enabled:           boolean;
  }
  @message model DeleteProviderModelConfigRequest {
    @field(1) id: string;
  }
  @message model DeleteProviderModelConfigResponse {}

  @message model ProviderInfo {
    @field(1) id:   string;
    @field(2) name: string;
    @field(3) api:  string;
    @field(4) doc:  string;
    @field(5) env:  string[];
  }

  @message model ProviderModelInfo {
    @field(1)  providerId:        string;
    @field(2)  providerName:      string;
    @field(3)  modelId:           string;
    @field(4)  modelName:         string;
    @field(5)  upstream:          string;
    @field(6)  supportStreaming:  boolean;
    @field(7)  supportTools:      boolean;
    @field(8)  supportVision:     boolean;
    @field(9)  supportReasoning:  boolean;
    @field(10) defaultMaxTokens:  int32;
    @field(11) contextLength:     int32;
    @field(12) autoCompactLength: int32;
    @field(13) status:            string;
  }

  @message model ListProvidersRequest {}
  @message model ListProvidersResponse {
    @field(1) providers: ProviderInfo[];
  }
  @message model ListProviderModelsRequest {
    @field(1) providerId: string;
  }
  @message model ListProviderModelsResponse {
    @field(1) models: ProviderModelInfo[];
  }

  @message model LogEntry {
    @field(1)  id:                 string;
    @field(2)  proxyId:            string;
    @field(3)  sourceModel:        string;
    @field(4)  targetModel:        string;
    @field(5)  upstream:           string;
    @field(6)  inputTokens:        int64;
    @field(7)  outputTokens:       int64;
    @field(8)  totalTokens:        int64;
    @field(9)  durationMs:         int64;
    @field(10) timeToFirstTokenMs: int64;
    @field(11) isStream:           boolean;
    @field(12) isSuccess:          boolean;
    @field(13) errorMessage:       string;
    @field(14) createdAt:          int64;
  }
  @message model QueryLogsRequest {
    @field(1) proxyId: string;
    @field(2) fromTs:  int64;
    @field(3) toTs:    int64;
    @field(4) limit:   int32;
    @field(5) offset:  int32;
  }
  @message model QueryLogsResponse {
    @field(1) logs:  LogEntry[];
    @field(2) total: int64;
  }
  @message model GetTokenStatsRequest {
    @field(1) proxyId: string;
    @field(2) fromTs:  int64;
    @field(3) toTs:    int64;
  }
  @message model TokenStatsResponse {
    @field(1) totalInputTokens:  int64;
    @field(2) totalOutputTokens: int64;
    @field(3) totalTokens:       int64;
    @field(4) requestCount:      int64;
  }

  @message model TestProviderModelConfigRequest {
    @field(1) id: string;
  }
  @message model TestProviderModelConfigResponse {
    @field(1) success:    boolean;
    @field(2) message:    string;
    @field(3) statusCode: int32;
    @field(4) latencyMs:  int32;
  }

  @message model TestProxyRequest {
    @field(1) id: string;
  }
  @message model TestProxyResponse {
    @field(1) success:    boolean;
    @field(2) message:    string;
    @field(3) statusCode: int32;
    @field(4) latencyMs:  int32;
  }
}
