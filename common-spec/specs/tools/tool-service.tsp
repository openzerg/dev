import "@typespec/protobuf";

using Protobuf;

/**
 * ToolService — OpenZergUltra unified tool invocation protocol.
 * All tool services (tool-fs, tool-job, tool-memory, tool-web, etc.) must implement this interface.
 */
@package({ name: "tools.v1" })
namespace ToolsV1 {

  @Protobuf.service
  interface ToolService {
    listTools(...ListToolsRequest): ListToolsResponse;
    executeTool(...ExecuteToolRequest): ExecuteToolResponse;
  }

  @message model ListToolsRequest {}

  @message model ListToolsResponse {
    @field(1) tools: ToolDefinition[];
    @field(2) systemContext: string;
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

  @message model ExecuteToolRequest {
    @field(1) toolName:     string;
    @field(2) argsJson:     string;
    @field(3) sessionToken: string;
  }

  @message model ExecuteToolResponse {
    @field(1) resultJson: string;
    @field(2) success:    boolean;
    @field(3) error:      string;
    @field(4) metadata:   Map<string, string>;
  }
}
