# API 设计规范

## 1. 总体原则

OpenZergUltra 的所有服务 API 遵循统一设计规范：

- **唯一来源**：所有 API 定义在 `common-spec` 仓库的 TypeSpec 文件中
- **生成优先**：服务接口和工具参数 schema 均由 TypeSpec 生成，不手写
- **强类型**：服务接口编译期强类型（proto → stubs），工具参数运行时强类型（JSON Schema → zod/jsonschema）
- **版本化**：所有服务 API 含版本前缀（`/v1/`），为将来兼容性预留

---

## 2. TypeSpec 仓库结构

```
common-spec/
├── specs/
│   ├── shared/
│   │   ├── common.tsp          # 共享类型（Pagination, Error, Timestamp 等）
│   │   └── auth.tsp            # 鉴权相关类型（JWT claims 等）
│   ├── registry.tsp           # RegistryService 定义
│   ├── agent.tsp      # AgentService 定义
│   ├── worker.tsp           # WorkspaceService 定义
│   ├── zcp-skill.tsp          # RoleLayerService 定义
│   ├── channel.tsp               # ChannelService 定义
│   ├── ai-proxy.tsp               # AiProxyService 定义
│   └── tools/
│       ├── tool-service.tsp    # ToolService 协议（通用工具调用接口）
│       ├── filesystem.tsp      # 文件系统工具参数（JSON Schema）
│       ├── execution.tsp       # 执行工具参数（JSON Schema）
│       ├── memory.tsp          # 记忆工具参数（JSON Schema）
│       ├── todo.tsp            # Todo 工具参数（JSON Schema）
│       ├── chatroom.tsp        # 聊天室工具参数（JSON Schema）
│       └── skill.tsp           # Skill 工具参数（JSON Schema）
├── tspconfig.yaml
├── buf.yaml
├── buf.gen.yaml
├── migrations/                 # PostgreSQL schema migrations
├── generated/
│   ├── proto/                  # tsp compile 输出
│   ├── schemas/tools/          # JSON Schema 输出
│   ├── node/src/gen/           # buf generate → TS stubs
│   └── go/gen/                 # buf generate → Go stubs
├── client/
│   ├── node/                   # 手写 TS client wrapper（发布为 npm 包）
│   └── go/                     # 手写 Go client wrapper（发布为 go module）
└── package.json                # TypeSpec 工具链版本固定
```

---

## 3. TypeSpec 编写规范

### 服务接口（生成 proto）

```typescript
// 使用 @typespec/protobuf 装饰器
import "@typespec/protobuf";
using TypeSpec.Protobuf;

@package({ name: "registry.v1" })
namespace RegistryV1 {

  @service
  interface RegistryService {
    // Unary RPC
    login(req: LoginRequest): LoginResponse;

    // Server-streaming RPC（用于事件订阅）
    @stream(StreamMode.Server)
    subscribeSessionEvents(req: SubscribeRequest): SessionEvent;
  }

  // 每个 message 字段必须标注 @field(N)
  @message model LoginRequest {
    @field(1) apiKey: string;
  }

  @message model LoginResponse {
    @field(1) userToken: string;
    @field(2) expiresAt: string;
  }
}
```

### 工具参数（生成 JSON Schema）

```typescript
// 使用 @typespec/json-schema 装饰器
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace FilesystemTools {

  /** 读取文件或目录 */
  model ReadArgs {
    /** 文件路径，相对于 worker 根目录 */
    path: string;

    /** 起始行号（1-indexed） */
    @minValue(1)
    offset?: int32;

    /** 最大读取行数 */
    @minValue(1) @maxValue(10000)
    limit?: int32;
  }

  model ReadResult {
    content: string;
    truncated: boolean;
    totalLines: int32;
  }
}
```

### 编译命令

```bash
cd common-spec

# 生成 proto + JSON Schema
tsp compile specs/

# 从 proto 生成 Go + TS stubs
buf generate generated/proto/

# 完整工具链（CI 使用）
make generate
```

---

## 4. ConnectRPC 服务接口规范

### URL 格式

```
/{PackageName}.{ServiceName}/{MethodName}

示例：
  /registry.v1.RegistryService/Login
  /agent.v1.AgentService/SubscribeSessionEvents
  /worker.v1.WorkspaceService/ExecuteTool
  /role_layer.v1.RoleLayerService/ListRoles
```

### 请求/响应格式

**Content-Type**：`application/json`（ConnectRPC JSON 模式，便于调试）
**或**：`application/proto`（protobuf 二进制，性能优先）

```bash
# curl 调试示例
curl -X POST http://localhost:15319/registry.v1.RegistryService/Login \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key"}'
```

### 鉴权

所有需要认证的接口：

```
Authorization: Bearer <JWT>
```

JWT Payload 结构：

```json
{
  "sub": "user_id_or_service_name",
  "type": "user | service",
  "roles": ["admin"],
  "exp": 1234567890
}
```

Public 接口（无需 token）：

- `RegistryService/Login`

Service-to-Service 接口（需要 service token）：

- `AgentService/*`（agent → agent）
- `WorkspaceService/*`（agent → worker）

### 错误码

使用 ConnectRPC 标准错误码：

| 错误码 | 含义 | 示例 |
|--------|------|------|
| `CodeUnauthenticated` | 未认证或 token 过期 | 无 JWT / JWT 失效 |
| `CodePermissionDenied` | 权限不足 | 普通用户访问管理接口 |
| `CodeNotFound` | 资源不存在 | Session ID 不存在 |
| `CodeInvalidArgument` | 请求参数无效 | 工具参数 JSON Schema 验证失败 |
| `CodeFailedPrecondition` | 前置条件不满足 | Session 处于 running 状态时创建 |
| `CodeInternal` | 服务内部错误 | 数据库连接失败 |
| `CodeUnavailable` | 服务暂时不可用 | agent 重启中 |

---

## 5. ToolService 协议（核心）

ToolService 是 OpenZergUltra 的工具调用协议，所有 MCP server 都必须实现此接口。

### Proto 定义（由 TypeSpec 生成）

```protobuf
syntax = "proto3";
package tools.v1;

service ToolService {
  // 列出该服务提供的所有工具
  rpc ListTools(ListToolsRequest) returns (ListToolsResponse);

  // 执行工具（非流式）
  rpc ExecuteTool(ExecuteToolRequest) returns (ExecuteToolResponse);

  // 执行工具（流式输出，用于 job-run 等长时间任务）
  rpc StreamTool(ExecuteToolRequest) returns (stream ToolOutputChunk);
}

message ListToolsRequest {}

message ListToolsResponse {
  repeated ToolDefinition tools = 1;
}

message ToolDefinition {
  string name = 1;              // 工具名，全局唯一标识
  string description = 2;       // 工具描述（发给 LLM）
  string input_schema_json = 3; // JSON Schema 字符串（TypeSpec 生成）
  string output_schema_json = 4;// 返回值 JSON Schema（可选）
  string group = 5;             // 工具分组（UI 展示用）
  int32 priority = 6;           // 优先级（同名工具取最高 priority）
}

message ExecuteToolRequest {
  string tool_name = 1;         // 工具名
  string args_json = 2;         // 符合 input_schema_json 的 JSON 字符串
  string session_token = 3;     // 调用方的 JWT（用于 identity 提取和日志）
}

message ExecuteToolResponse {
  string result_json = 1;       // 符合 output_schema_json 的 JSON 字符串
  bool success = 2;
  string error = 3;             // success=false 时的错误信息
  map<string, string> metadata = 4; // 附加元数据（duration_ms 等）
}

message ToolOutputChunk {
  string content = 1;           // 本次流式输出内容
  bool done = 2;                // true 表示流结束
  bool success = 3;             // done=true 时有效
  string error = 4;             // done=true && success=false 时有效
}
```

### 工具参数验证规范

每个实现了 ToolService 的服务，在 `ExecuteTool` 中必须：

```typescript
// TypeScript（agent 消费 ToolService 的方式）
async executeTool(req: ExecuteToolRequest): Promise<ExecuteToolResponse> {
  // 1. 解析 argsJson
  let args: unknown
  try {
    args = JSON.parse(req.argsJson)
  } catch {
    throw new ConnectError("argsJson is not valid JSON", Code.InvalidArgument)
  }

  // 2. 用 zod 验证（schema 由 TypeSpec JSON Schema 生成对应 zod）
  const parseResult = ReadArgsSchema.safeParse(args)
  if (!parseResult.success) {
    throw new ConnectError(
      `Invalid args: ${parseResult.error.message}`,
      Code.InvalidArgument
    )
  }

  // 3. 执行工具逻辑
  const typedArgs = parseResult.data
  const content = await fs.readFile(resolve(worker, typedArgs.path), 'utf-8')

  // 4. 返回 result_json
  return {
    resultJson: JSON.stringify({ content, truncated: false }),
    success: true,
  }
}
```

### agent 工具路由器

```typescript
class ToolRouter {
  private routes = new Map<string, { client: ToolServiceClient; def: ToolDefinition }>()

  // Session 启动/Role 变更时重建
  async rebuild(roleConfig: Role, workerUrls?: MCPEndpoints) {
    this.routes.clear()
    const allServers = [
      ...(workerUrls ? [
        { url: workerUrls.filesystemUrl },
        { url: workerUrls.executionUrl },
      ] : []),
      ...roleConfig.mcpServers.filter(s => s.enabled),
    ]

    for (const server of allServers) {
      const client = new ToolServiceClient({ baseURL: server.url, token: this.serviceToken })
      const resp = await client.listTools({})
      for (const tool of resp.tools) {
        const existing = this.routes.get(tool.name)
        if (!existing || tool.priority > existing.def.priority) {
          this.routes.set(tool.name, { client, def: tool })
        }
      }
    }
  }

  // LLM 推理时调用
  async execute(toolName: string, argsJson: string, sessionToken: string): Promise<ToolOutputChunk[]> {
    const route = this.routes.get(toolName)
    if (!route) throw new Error(`Unknown tool: ${toolName}`)
    return route.client.executeTool({ toolName, argsJson, sessionToken })
  }

  // 发给 LLM 的工具定义列表
  getLLMTools(): OpenAITool[] {
    return [...this.routes.values()].map(({ def }) => ({
      type: 'function',
      function: {
        name: def.name,
        description: def.description,
        parameters: JSON.parse(def.inputSchemaJson),
      }
    }))
  }
}
```

---

## 6. 事件流设计

### registry → agent → WebUI

```
1. WebUI 请求查看 session-1 的事件：
   GET /agent.v1.AgentService/SubscribeSessionEvents
   { sessionId: "session-1" }

2.    agent 查 PostgreSQL：session-1 当前在 runner-B
   agent 向 runner-B 建立 server-streaming 连接：
   GET /agent.v1.AgentService/ForwardSessionEvents
   { sessionId: "session-1", subscriberId: "webui-conn-xyz" }

3. runner-B 推理过程中产生事件：
   runner-B → agent stream → WebUI stream

4. WebUI 断开连接：
   agent 通知 runner-B 取消订阅
```

### 事件类型定义（TypeSpec）

```typescript
@message model SessionEvent {
  @field(1) sessionId: string;
  @field(2) eventType: SessionEventType;
  @field(3) payload: string;            // JSON 序列化的事件内容
  @field(4) createdAt: string;
}

enum SessionEventType {
  Connected = "connected",
  UserMessageSaved = "user_message_saved",
  Thinking = "thinking",
  Response = "response",              // LLM 文本输出（流式）
  ToolCall = "tool_call",
  ToolResult = "tool_result",
  Done = "done",
  Error = "error",
  Interrupted = "interrupted",
  Compacting = "compacting",
  Compacted = "compacted",
}
```

---

## 7. client wrapper 设计规范

`common-spec/client/` 目录下的 client wrapper 遵循以下约定：

### TypeScript client

```typescript
// client/node/agent.ts
export class AgentClient {
  private client: PromiseClient<typeof AgentService>
  private token: string = ''

  constructor(opts: { baseURL: string; token?: string; transport?: TransportFactory }) {
    // 使用闭包确保 token 更新不需要重建 client
    const authInterceptor = createAuthInterceptor(() => this.token)
    const transport = (opts.transport ?? createWebTransport)(opts.baseURL, [authInterceptor])
    this.client = createPromiseClient(AgentService, transport)
    if (opts.token) this.token = opts.token
  }

  // 登录后自动存 token（唯一业务逻辑）
  async login(apiKey: string): Promise<LoginResponse> {
    const resp = await this.client.login({ apiKey })
    this.token = resp.userToken   // 自动存储
    return resp
  }

  // 其余方法均为薄包装，ergonomic flat args → proto request
  async createSession(roleId: string, opts?: { workerId?: string; sessionType?: string }) {
    return this.client.createSession({ roleId, ...opts })
  }
  // ...
}
```

### Go client

```go
// client/go/agent.go
type AgentClient struct {
    baseURL string
    token   string
    client  agentv1connect.AgentServiceClient
}

func NewAgentClient(baseURL string, opts ...AgentOption) *AgentClient {
    c := &AgentClient{baseURL: baseURL}
    for _, opt := range opts { opt(c) }
    c.rebuild()
    return c
}

func (c *AgentClient) SetToken(token string) {
    c.token = token
    c.rebuild()   // Go 无闭包技巧，需重建 client
}

func (c *AgentClient) Login(ctx context.Context, apiKey string) (*agentv1.LoginResponse, error) {
    resp, err := c.client.Login(ctx, connect.NewRequest(&agentv1.LoginRequest{ApiKey: apiKey}))
    if err != nil { return nil, err }
    c.SetToken(resp.Msg.UserToken)   // 自动存储
    return resp.Msg, nil
}
```
