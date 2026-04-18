import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace MemoryTools {

  model MemoryWriteArgs {
    filename: string;
    content: string;
  }

  model MemoryReadArgs {
    filename: string;
  }

  model MemoryReadResult {
    content: string;
    updatedAt: string;
  }

  model MemoryListArgs {}

  model MemoryEntry {
    filename: string;
    sizeBytes: int32;
    updatedAt: string;
  }
}
