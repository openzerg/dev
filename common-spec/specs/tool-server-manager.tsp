import "@typespec/protobuf";

using Protobuf;

/**
 * ToolServerManagerService — Manages tool server containers + tool discovery + execution routing.
 * Owns Podman socket for tool server container lifecycle.
 * Uses registry_instances (shared DB) for service discovery.
 * Owns cached_tools for tool definitions cache.
 */
@package({ name: "toolservermanager.v1" })
namespace ToolServerManagerV1 {

  @message model ToolServerUrl {
    @field(1) name:   string;
    @field(2) url:    string;
    @field(3) config: Map<string, string>;
  }

  @message model ToolDefinition {
    @field(1) name:             string;
    @field(2) description:      string;
    @field(3) inputSchemaJson:  string;
    @field(4) outputSchemaJson: string;
    @field(5) group:            string;
    @field(6) priority:         int32;
    @field(7) dependencies:     string[];
  }

  @message model ContainerEnv {
    @field(1) key:   string;
    @field(2) value: string;
  }

  // ── Tool Server Container Lifecycle ──────────────────────────────────────

  @message model StartToolServerRequest {
    @field(1) type:    string;
    @field(2) image:   string;
    @field(3) env:     ContainerEnv[];
    @field(4) command: string[];
  }

  @message model StartToolServerResponse {
    @field(1) containerName: string;
    @field(2) instanceId:    string;
  }

  @message model StopToolServerRequest {
    @field(1) type: string;
  }

  @message model StopToolServerResponse {}

  @message model ListToolServersRequest {}

  @message model ToolServerInfo {
    @field(1) instanceId:    string;
    @field(2) name:          string;
    @field(3) type:          string;
    @field(4) url:           string;
    @field(5) port:          int32;
    @field(6) lifecycle:     string;
    @field(7) toolCount:     int32;
    @field(8) containerName: string;
  }

  @message model ListToolServersResponse {
    @field(1) servers: ToolServerInfo[];
  }

  // ── Tool Cache ───────────────────────────────────────────────────────────

  @message model RefreshToolCacheRequest {
    @field(1) instanceType: string;
  }

  @message model RefreshToolCacheResponse {
    @field(1) toolCount: int32;
  }

  // ── Tool Resolution + Execution ──────────────────────────────────────────

  @message model ResolveToolsRequest {
    @field(1) sessionId:      string;
    @field(2) toolServerTypes: string[];
  }

  @message model ResolveToolsResponse {
    @field(1) tools:           ToolDefinition[];
    @field(2) systemContext:   string;
    @field(3) toolServerUrls:  ToolServerUrl[];
  }

  @message model ExecuteToolRequest {
    @field(1) sessionId:    string;
    @field(2) toolName:     string;
    @field(3) argsJson:     string;
    @field(4) sessionToken: string;
  }

  @message model ExecuteToolResponse {
    @field(1) resultJson: string;
    @field(2) success:    boolean;
    @field(3) error:      string;
    @field(4) metadata:   Map<string, string>;
  }

  @message model HealthRequest {}

  @message model HealthResponse {
    @field(1) status: string;
  }

  // ── Service ──────────────────────────────────────────────────────────────

  @Protobuf.service
  interface ToolServerManagerService {
    health(...HealthRequest): HealthResponse;

    startToolServer(...StartToolServerRequest): StartToolServerResponse;
    stopToolServer(...StopToolServerRequest): StopToolServerResponse;
    listToolServers(...ListToolServersRequest): ListToolServersResponse;
    refreshToolCache(...RefreshToolCacheRequest): RefreshToolCacheResponse;

    resolveTools(...ResolveToolsRequest): ResolveToolsResponse;
    executeTool(...ExecuteToolRequest): ExecuteToolResponse;
  }
}
