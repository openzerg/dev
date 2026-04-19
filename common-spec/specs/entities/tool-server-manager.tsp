import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace ToolServerEntities {

  @jsonSchema
  @extension("x-table", "cached_tools")
  @extension("x-primary-key", "id")
  @extension("x-indexes", #[
    #["serviceId"],
    #["toolName"],
    #["group"]
  ])
  model CachedTool {
    id: string;
    serviceId: string;
    toolName: string;
    description: string;
    inputSchemaJson: string;
    outputSchemaJson: string;
    group: string;
    priority: int32;
    dependencies: string;
    createdAt: int64;
    updatedAt: int64;
  }
}
