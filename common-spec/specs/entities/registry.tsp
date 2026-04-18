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
  @extension("x-table", "registry_roles")
  @extension("x-primary-key", "id")
  @extension("x-unique", #["name"])
  model Role {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    aiProxyId: string;
    zcpServers: string;
    skills: string;
    extraPkgs: string;
    maxSteps: int32;
    createdAt: int64;
    updatedAt: int64;
  }

  @jsonSchema
  @extension("x-table", "registry_sessions")
  @extension("x-primary-key", "id")
  @extension("x-unique", #["sessionToken"])
  @extension("x-indexes", #[
    #["roleId"],
    #["workerId"],
    #["agentId"],
    #["state"],
    #["workspaceId"],
    #["createdAt"]
  ])
  model Session {
    id: string;
    title: string;
    roleId: string;
    workerId: string;
    agentId: string;
    sessionToken: string;
    state: string;
    workspaceId: string;
    inputTokens: int64;
    outputTokens: int64;
    lastActiveAt: int64;
    createdAt: int64;
    updatedAt: int64;
  }

  @jsonSchema
  @extension("x-table", "registry_workspaces")
  @extension("x-primary-key", "id")
  @extension("x-indexes", #[
    #["state"],
    #["boundSessionId"]
  ])
  model Workspace {
    id: string;
    volumeName: string;
    state: string;
    boundSessionId: string;
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

  @jsonSchema
  @extension("x-table", "registry_workers")
  @extension("x-primary-key", "id")
  @extension("x-unique", #["name"])
  @extension("x-indexes", #[
    #["lifecycle"]
  ])
  model Worker {
    id: string;
    name: string;
    containerName: string;
    image: string;
    secret: string;
    lifecycle: string;
    workspaceRoot: string;
    filesystemUrl: string;
    executionUrl: string;
    createdAt: int64;
    updatedAt: int64;
  }
}
