import "@typespec/protobuf";

using Protobuf;

/**
 * ToolService — OpenZergUltra 统一工具调用协议
 * 所有工具服务（zcp-fs、zcp-job、zcp-skill、channel 等）必须实现此接口
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
