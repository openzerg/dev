import "@typespec/protobuf";

using Protobuf;

/**
 * RegistryService — 注册中心 + 鉴权 + Session 管理 + Template 管理
 */
@package({ name: "registry.v1" })
namespace RegistryV1 {

  // ── ZSP Sub-Models ──────────────────────────────────────────────────────

  @message model ProviderConfig {
    @field(1) upstream:          string;
    @field(2) apiKey:            string;
    @field(3) modelId:           string;
    @field(4) maxTokens:         int32;
    @field(5) contextLength:     int32;
    @field(6) autoCompactLength: int32;
  }

  @message model ToolServerEntry {
    @field(1) type:   string;
    @field(2) config: Map<string, string>;
  }

  @message model SkillRef {
    @field(1) slug: string;
  }

  @message model WorkspaceConfig {}

  // ── Auth ──────────────────────────────────────────────────────────────────

  @message model LoginRequest {
    @field(1) apiKey: string;
  }

  @message model LoginResponse {
    @field(1) userToken:    string;
    @field(2) expiresInSec: int32;
  }

  // ── Service Registration ─────────────────────────────────────────────────

  @message model RegisterRequest {
    @field(1) name:         string;
    @field(2) instanceType: string;
    @field(3) ip:           string;
    @field(4) port:         int32;
    @field(5) publicUrl:    string;
    @field(6) metadata:     Map<string, string>;
  }

  @message model RegisterResponse {
    @field(1) instanceId:   string;
    @field(2) serviceToken: string;
  }

  @message model HeartbeatRequest {
    @field(1) instanceId: string;
  }

  @message model HeartbeatResponse {}

  @message model ListInstancesRequest {
    @field(1) instanceType: string;
  }

  @message model InstanceInfo {
    @field(1) instanceId:   string;
    @field(2) name:         string;
    @field(3) instanceType: string;
    @field(4) url:          string;
    @field(5) lifecycle:    string;
    @field(6) lastSeen:     int64;
    @field(7) metadata:     Map<string, string>;
  }

  @message model ListInstancesResponse {
    @field(1) instances: InstanceInfo[];
  }

  // ── Template CRUD ────────────────────────────────────────────────────────

  @message model TemplateInfo {
    @field(1)  id:                string;
    @field(2)  name:              string;
    @field(3)  description:       string;
    @field(4)  systemPrompt:      string;
    @field(5)  providerConfig:    ProviderConfig;
    @field(6)  toolServerConfig:   ToolServerEntry[];
    @field(7)  skillConfig:       SkillRef[];
    @field(8)  workspaceConfig:   WorkspaceConfig;
    @field(9)  extraPackage:      string[];
    @field(10) createdAt:         int64;
    @field(11) updatedAt:         int64;
  }

  @message model ListTemplatesRequest {}

  @message model ListTemplatesResponse {
    @field(1) templates: TemplateInfo[];
  }

  @message model GetTemplateRequest {
    @field(1) templateId: string;
  }

  @message model CreateTemplateRequest {
    @field(1)  name:              string;
    @field(2)  description:       string;
    @field(3)  systemPrompt:      string;
    @field(4)  providerConfig:    ProviderConfig;
    @field(5)  toolServerConfig:   ToolServerEntry[];
    @field(6)  skillConfig:       SkillRef[];
    @field(7)  workspaceConfig:   WorkspaceConfig;
    @field(8)  extraPackage:      string[];
  }

  @message model UpdateTemplateRequest {
    @field(1)  id:                string;
    @field(2)  name:              string;
    @field(3)  description:       string;
    @field(4)  systemPrompt:      string;
    @field(5)  providerConfig:    ProviderConfig;
    @field(6)  toolServerConfig:   ToolServerEntry[];
    @field(7)  skillConfig:       SkillRef[];
    @field(8)  workspaceConfig:   WorkspaceConfig;
    @field(9)  extraPackage:      string[];
  }

  @message model DeleteTemplateRequest {
    @field(1) templateId: string;
  }

  @message model DeleteTemplateResponse {}

  // ── Session ──────────────────────────────────────────────────────────────

  @message model SessionInfo {
    @field(1)  sessionId:        string;
    @field(2)  title:            string;
    @field(3)  state:            string;
    @field(4)  templateId:       string;
    @field(5)  createdAt:        int64;
    @field(6)  updatedAt:        int64;

    // ZSP snapshot
    @field(7)  systemPrompt:     string;
    @field(8)  providerConfig:   ProviderConfig;
    @field(9)  toolServerConfig:  ToolServerEntry[];
    @field(10) skillConfig:      SkillRef[];
    @field(11) workspaceConfig:  WorkspaceConfig;
    @field(12) extraPackage:     string[];

    // Infrastructure
    @field(13) workerId:         string;
    @field(14) agentId:          string;
    @field(15) sessionToken:     string;
    @field(16) workspaceId:      string;
    @field(17) inputTokens:      int64;
    @field(18) outputTokens:     int64;
    @field(19) lastActiveAt:     int64;
  }

  @message model ListSessionsRequest {
    @field(1) state: string;
  }

  @message model ListSessionsResponse {
    @field(1) sessions: SessionInfo[];
  }

  @message model GetSessionRequest {
    @field(1) sessionId: string;
  }

  /**
   * CreateSessionRequest — ZSP 协议入口。
   *
   * 方式 A (纯模板):     { title, templateId }
   * 方式 B (模板+覆盖):  { title, templateId, systemPrompt: "..." }
   * 方式 C (纯内联):     { title, systemPrompt: "...", providerConfig: {...}, ... }
   *
   * 合并: result = request.field || template.field || default
   */
  @message model CreateSessionRequest {
    @field(1)  title:             string;
    @field(2)  templateId:        string;
    @field(3)  systemPrompt:      string;
    @field(4)  providerConfig:    ProviderConfig;
    @field(5)  toolServerConfig:   ToolServerEntry[];
    @field(6)  skillConfig:       SkillRef[];
    @field(7)  workspaceConfig:   WorkspaceConfig;
    @field(8)  extraPackage:      string[];
    @field(9)  workspaceId:       string;
  }

  @message model CreateSessionResponse {
    @field(1) sessionId:    string;
    @field(2) sessionToken: string;
    @field(3) session:      SessionInfo;
  }

  @message model UpdateSessionMetaRequest {
    @field(1) sessionId: string;
    @field(2) title:     string;
  }

  @message model UpdateSessionHotConfigRequest {
    @field(1) sessionId:        string;
    @field(2) systemPrompt:     string;
    @field(3) providerConfig:   ProviderConfig;
    @field(4) skillConfig:      SkillRef[];
  }

  @message model UpdateSessionColdConfigRequest {
    @field(1) sessionId:       string;
    @field(2) toolServerConfig: ToolServerEntry[];
    @field(3) extraPackage:    string[];
  }

  @message model SwitchSessionTemplateRequest {
    @field(1) sessionId:   string;
    @field(2) templateId:  string;
  }

  @message model DeleteSessionRequest {
    @field(1) sessionId: string;
  }

  @message model DeleteSessionResponse {}

  @message model StartSessionRequest {
    @field(1) sessionId: string;
  }

  @message model StartSessionResponse {}

  @message model StopSessionRequest {
    @field(1) sessionId: string;
  }

  @message model StopSessionResponse {}

  @message model ResolveSessionRequest {
    @field(1) sessionToken: string;
  }

  @message model ResolveSessionResponse {
    @field(1)  sessionId:       string;
    @field(2)  templateId:      string;
    @field(3)  systemPrompt:    string;
    @field(4)  providerConfig:  ProviderConfig;
    @field(5)  toolServerConfig: ToolServerEntry[];
    @field(6)  skillConfig:     SkillRef[];
    @field(7)  extraPackage:    string[];
    @field(8)  workerId:        string;
    @field(9)  workerUrl:       string;
    @field(10) workerSecret:    string;
    @field(11) workspaceRoot:   string;
    @field(12) agentUrl:        string;
    @field(13) toolServerUrls:   ToolServerUrl[];
    @field(14) workspaceId:     string;
  }

  @message model ToolServerUrl {
    @field(1) name:   string;
    @field(2) url:    string;
    @field(3) config: string;
  }

  // ── Message ──────────────────────────────────────────────────────────────

  @message model MessageInfo {
    @field(1)  id:            string;
    @field(2)  sessionId:     string;
    @field(3)  role:          string;
    @field(4)  parentMessageId: string;
    @field(5)  toolCallId:    string;
    @field(6)  toolName:      string;
    @field(7)  content:       string;
    @field(8)  tokenUsage:    string;
    @field(9)  metadata:      string;
    @field(10) compacted:     boolean;
    @field(11) createdAt:     int64;
  }

  @message model ListMessagesRequest {
    @field(1) sessionId: string;
    @field(2) limit:     int32;
    @field(3) beforeId:  string;
  }

  @message model ListMessagesResponse {
    @field(1) messages:     MessageInfo[];
    @field(2) hasMore:      boolean;
    @field(3) nextBeforeId: string;
  }

  @message model CreateMessageRequest {
    @field(1) sessionId:       string;
    @field(2) role:            string;
    @field(3) parentMessageId: string;
    @field(4) toolCallId:      string;
    @field(5) toolName:        string;
    @field(6) content:         string;
    @field(7) tokenUsage:      string;
    @field(8) metadata:        string;
  }

  @message model CreateMessageResponse {
    @field(1) messageId: string;
  }

  @message model DeleteMessagesFromRequest {
    @field(1) sessionId:  string;
    @field(2) messageId:  string;
  }

  @message model DeleteMessagesFromResponse {}

  // ── Service ──────────────────────────────────────────────────────────────

  @Protobuf.service
  interface RegistryService {
    // Auth
    login(...LoginRequest): LoginResponse;

    // Service Registration
    register(...RegisterRequest): RegisterResponse;
    heartbeat(...HeartbeatRequest): HeartbeatResponse;
    listInstances(...ListInstancesRequest): ListInstancesResponse;

    // Template CRUD
    listTemplates(...ListTemplatesRequest): ListTemplatesResponse;
    getTemplate(...GetTemplateRequest): TemplateInfo;
    createTemplate(...CreateTemplateRequest): TemplateInfo;
    updateTemplate(...UpdateTemplateRequest): TemplateInfo;
    deleteTemplate(...DeleteTemplateRequest): DeleteTemplateResponse;

    // Session CRUD + Lifecycle
    listSessions(...ListSessionsRequest): ListSessionsResponse;
    getSession(...GetSessionRequest): SessionInfo;
    createSession(...CreateSessionRequest): CreateSessionResponse;
    updateSessionMeta(...UpdateSessionMetaRequest): SessionInfo;
    updateSessionHotConfig(...UpdateSessionHotConfigRequest): SessionInfo;
    updateSessionColdConfig(...UpdateSessionColdConfigRequest): SessionInfo;
    switchSessionTemplate(...SwitchSessionTemplateRequest): SessionInfo;
    deleteSession(...DeleteSessionRequest): DeleteSessionResponse;
    startSession(...StartSessionRequest): StartSessionResponse;
    stopSession(...StopSessionRequest): StopSessionResponse;
    resolveSession(...ResolveSessionRequest): ResolveSessionResponse;

    // Message CRUD
    listMessages(...ListMessagesRequest): ListMessagesResponse;
    createMessage(...CreateMessageRequest): CreateMessageResponse;
    deleteMessagesFrom(...DeleteMessagesFromRequest): DeleteMessagesFromResponse;
  }
}
