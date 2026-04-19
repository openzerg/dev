import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace RegistryEntities {

  @jsonSchema
  @extension("x-table", "registry_instances")
  @extension("x-primary-key", "id")
  @extension("x-int64-fields", #["lastSeen"])
  @extension("x-indexes", #[
    #["instanceType"],
    #["lastSeen"]
  ])
  model Instance {
    id: string;
    name: string;
    instanceType: string;
    ip: string;
    port: int32;
    publicUrl: string;
    lifecycle: string;
    lastSeen: int64;
    metadata: Record<string>;
    createdAt: int64;
    updatedAt: int64;
  }

  @jsonSchema
  @extension("x-table", "session_templates")
  @extension("x-primary-key", "id")
  @extension("x-unique", #["name"])
  model SessionTemplate {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    upstream: string;
    apiKey: string;
    modelId: string;
    maxTokens: int32;
    contextLength: int32;
    autoCompactLength: int32;
    toolServers: string;
    skills: string;
    extraPkgs: string;
    createdAt: int64;
    updatedAt: int64;
  }

  @jsonSchema
  @extension("x-table", "registry_sessions")
  @extension("x-primary-key", "id")
  @extension("x-unique", #["sessionToken"])
  @extension("x-indexes", #[
    #["templateId"],
    #["workerId"],
    #["agentId"],
    #["state"],
    #["workspaceId"],
    #["createdAt"]
  ])
  model Session {
    id: string;
    title: string;
    templateId: string;
    state: string;
    systemPrompt: string;
    upstream: string;
    apiKey: string;
    modelId: string;
    maxTokens: int32;
    contextLength: int32;
    autoCompactLength: int32;
    toolServers: string;
    skills: string;
    extraPkgs: string;
    workerId: string;
    agentId: string;
    sessionToken: string;
    workspaceId: string;
    inputTokens: int64;
    outputTokens: int64;
    lastActiveAt: int64;
    createdAt: int64;
    updatedAt: int64;
  }

  @jsonSchema
  @extension("x-table", "registry_messages")
  @extension("x-primary-key", "id")
  @extension("x-indexes", #[
    #["sessionId"],
    #["sessionId", "createdAt"],
    #["sessionId", "compacted"]
  ])
  model Message {
    id: string;
    sessionId: string;
    role: string;
    parentMessageId: string;
    toolCallId: string;
    toolName: string;
    content: string;
    tokenUsage: string;
    metadata: string;
    compacted: boolean;
    createdAt: int64;
  }

}
