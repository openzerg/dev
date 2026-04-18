import "@typespec/protobuf";

using Protobuf;

/**
 * RegistryService — 注册中心 + 鉴权 + Session 管理 + Role 管理 + Workspace 管理
 */
@package({ name: "registry.v1" })
namespace RegistryV1 {

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

  // ── Role ──────────────────────────────────────────────────────────────────

  @message model RoleInfo {
    @field(1)  id:              string;
    @field(2)  name:            string;
    @field(3)  description:     string;
    @field(4)  systemPrompt:    string;
    @field(5)  aiProxyId:       string;
    @field(6)  zcpServers:      string;
    @field(7)  skills:          string;
    @field(8)  maxSteps:        int32;
    @field(9)  extraPkgs:       string;
    @field(10) createdAt:       int64;
    @field(11) updatedAt:       int64;
  }

  @message model ListRolesRequest {}

  @message model ListRolesResponse {
    @field(1) roles: RoleInfo[];
  }

  @message model GetRoleRequest {
    @field(1) roleId: string;
  }

  @message model CreateRoleRequest {
    @field(1)  name:            string;
    @field(2)  description:     string;
    @field(3)  systemPrompt:    string;
    @field(4)  aiProxyId:       string;
    @field(5)  zcpServers:      string;
    @field(6)  maxSteps:        int32;
    @field(7)  skills:          string;
    @field(8)  extraPkgs:       string;
  }

  @message model UpdateRoleHotConfigRequest {
    @field(1)  id:              string;
    @field(2)  systemPrompt:    string;
    @field(3)  aiProxyId:       string;
    @field(4)  skills:          string;
    @field(5)  maxSteps:        int32;
  }

  @message model UpdateRoleWorkspaceConfigRequest {
    @field(1)  id:              string;
    @field(2)  name:            string;
    @field(3)  description:     string;
    @field(4)  zcpServers:      string;
    @field(5)  extraPkgs:       string;
  }

  @message model DeleteRoleRequest {
    @field(1) roleId: string;
  }

  @message model DeleteRoleResponse {}

  // ── Session ──────────────────────────────────────────────────────────────

  @message model SessionInfo {
    @field(1)  sessionId:     string;
    @field(2)  title:         string;
    @field(3)  roleId:        string;
    @field(4)  roleName:      string;
    @field(5)  workerId:      string;
    @field(6)  workerName:    string;
    @field(7)  agentId:       string;
    @field(8)  sessionToken:  string;
    @field(9)  state:         string;
    @field(10) inputTokens:   int64;
    @field(11) outputTokens:  int64;
    @field(12) createdAt:     int64;
    @field(13) updatedAt:     int64;
    @field(14) workspaceId:   string;
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

  @message model CreateSessionRequest {
    @field(1) title:    string;
    @field(2) roleId:   string;
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

  @message model SwitchSessionRoleRequest {
    @field(1) sessionId: string;
    @field(2) roleId:    string;
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
    @field(1)  sessionId:     string;
    @field(2)  roleId:        string;
    @field(3)  roleInfo:      RoleInfo;
    @field(4)  workerId:      string;
    @field(5)  workerUrl:     string;
    @field(6)  workerSecret:  string;
    @field(7)  workspaceRoot: string;
    @field(8)  agentUrl:      string;
    @field(9)  zcpServerUrls: ZcpServerUrl[];
    @field(10) workspaceId:   string;
  }

  @message model ZcpServerUrl {
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

  // ── Workspace Management ─────────────────────────────────────────────────

  @message model WorkspaceInfo {
    @field(1) workspaceId:    string;
    @field(2) volumeName:     string;
    @field(3) state:          string;
    @field(4) boundSessionId: string;
    @field(5) createdAt:      int64;
  }

  @message model ListWorkspacesRequest {}

  @message model ListWorkspacesResponse {
    @field(1) workspaces: WorkspaceInfo[];
  }

  @message model DeleteWorkspaceRequest {
    @field(1) workspaceId: string;
  }

  @message model DeleteWorkspaceResponse {}

  // ── Service ──────────────────────────────────────────────────────────────

  @Protobuf.service
  interface RegistryService {
    // Auth
    login(...LoginRequest): LoginResponse;

    // Service Registration
    register(...RegisterRequest): RegisterResponse;
    heartbeat(...HeartbeatRequest): HeartbeatResponse;
    listInstances(...ListInstancesRequest): ListInstancesResponse;

    // Role CRUD
    listRoles(...ListRolesRequest): ListRolesResponse;
    getRole(...GetRoleRequest): RoleInfo;
    createRole(...CreateRoleRequest): RoleInfo;
    updateRoleHotConfig(...UpdateRoleHotConfigRequest): RoleInfo;
    updateRoleWorkspaceConfig(...UpdateRoleWorkspaceConfigRequest): RoleInfo;
    deleteRole(...DeleteRoleRequest): DeleteRoleResponse;

    // Session CRUD + Lifecycle
    listSessions(...ListSessionsRequest): ListSessionsResponse;
    getSession(...GetSessionRequest): SessionInfo;
    createSession(...CreateSessionRequest): CreateSessionResponse;
    updateSessionMeta(...UpdateSessionMetaRequest): SessionInfo;
    switchSessionRole(...SwitchSessionRoleRequest): SessionInfo;
    deleteSession(...DeleteSessionRequest): DeleteSessionResponse;
    startSession(...StartSessionRequest): StartSessionResponse;
    stopSession(...StopSessionRequest): StopSessionResponse;
    resolveSession(...ResolveSessionRequest): ResolveSessionResponse;

    // Message CRUD
    listMessages(...ListMessagesRequest): ListMessagesResponse;
    createMessage(...CreateMessageRequest): CreateMessageResponse;
    deleteMessagesFrom(...DeleteMessagesFromRequest): DeleteMessagesFromResponse;

    // Workspace Management
    listWorkspaces(...ListWorkspacesRequest): ListWorkspacesResponse;
    deleteWorkspace(...DeleteWorkspaceRequest): DeleteWorkspaceResponse;
  }
}
