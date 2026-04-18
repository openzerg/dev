# 服务详细规范

## 服务一览

| 服务 | 语言 | 端口 | 职责 |
|------|------|------|------|
| registry | TypeScript/Bun | 15319 | 注册中心、鉴权、Session 路由、Workspace 管理 |
| agent | TypeScript (Bun) | 15330+ | Session 调度、LLM 推理、工具路由 |
| worker | TypeScript (Bun) | 15340+ | 文件系统 + 进程执行 ToolService |
| zcp-skill | Go | 15320 | Role/Skill/Memory/Todo 管理 + ToolService |
| channel | Go | 15318 | 消息总线 + 文件上传 + Chatroom ToolService |
| ai-proxy | TypeScript (Bun) | 15316 | LLM 代理（Provider 模板 + 自动 API Key） |
| overmind-webui | TypeScript (SolidJS) | 8080 | 管理控制台 |
| PostgreSQL | — | 5432 | 持久化存储 |
| PgBouncer | — | 5433 | 连接池（所有服务连接此端口） |
| Garage | Rust | 15322/15423 | S3 对象存储（文件上传） |
| Forgejo | Go | 15321 | Git 服务 |
| nginx | — | 8080 | 反向代理统一入口 |

---

## registry

### 核心职责

1. **鉴权网关**：颁发和验证 JWT，所有服务的认证入口
2. **服务注册**：接收所有服务的心跳，维护实例状态
3. **Session 元数据**：Session CRUD（存 PostgreSQL）
4. **Session 路由**：将 Chat/Notify 请求路由到正确的 agent 实例
5. **Workspace 管理**：通过 Podman API 管理 Workspace 容器生命周期
6. **事件中继**：按需将 agent 的事件转发给 WebUI

### ConnectRPC 接口

```
RegistryService：
  # 鉴权
  Login(apiKey) → userToken
  RefreshToken(userToken) → newToken

  # 服务注册
  Register(instanceInfo) → instanceId
  Heartbeat(instanceId) → void
  ListInstances(instanceType?) → instances[]
  GetInstance(instanceId) → instance

  # Session 管理
  CreateSession(roleId, workerId?, sessionType) → session
  DeleteSession(sessionId) → void
  GetSession(sessionId) → session
  ListSessions(filter?) → sessions[]
  Chat(sessionId, content) → void         # 路由到对应 runner
  SubscribeSessionEvents(sessionId) → stream<SessionEvent>

  # Workspace 管理
  SpawnWorkspace(name, description?) → worker
  StopWorkspace(workerId) → void
  DeleteWorkspace(workerId) → void
  ListWorkspaces() → workers[]
  GetWorkspace(workerId) → worker

  # @mention 路由（channel 调用）
  RouteNotify(chatroomId, agentName, content) → void

  # Forgejo 集成
  GetForgejoToken(userId) → token
```

### 环境变量

```bash
REGISTRY_PORT=15319
DATABASE_URL=postgresql://openzerg:${DB_PASSWORD}@localhost:5433/openzerg
JWT_SECRET=<随机 256-bit 密钥>
ADMIN_TOKEN=<管理员 API Key（明文，启动时 hash 后存 DB）>
HOST_IP=172.16.11.92
PODMAN_SOCKET=/run/user/1000/podman/podman.sock
WORKSPACE_IMAGE=localhost/worker:latest
WORKSPACE_PORT_START=15340
WORKSPACE_PORT_END=15399
SESSION_RUNNER_PORT_START=15330
SESSION_RUNNER_PORT_END=15339
FORGEJO_URL=http://localhost:15321
FORGEJO_ADMIN_TOKEN=<Forgejo 管理员 Token>
GATEWAY_URL=http://localhost:8080
```

### 目录结构

```
registry/
├── cmd/registry/main.go
├── internal/
│   ├── config/config.go
│   ├── middleware/auth.go          # JWT 鉴权拦截器
│   ├── service/
│   │   ├── auth.go                 # 登录/JWT 颁发
│   │   ├── registry.go             # 服务注册 + 心跳超时扫描
│   │   ├── sessions.go             # Session CRUD + 路由
│   │   ├── workers.go           # Workspace 生命周期（Podman）
│   │   ├── events.go               # 事件中继（按需订阅 runner）
│   │   ├── notify.go               # @mention 路由
│   │   └── forgejo.go              # Forgejo 集成
│   └── podman/
│       ├── client.go               # Podman REST API 客户端
│       └── worker.go            # Workspace 容器管理
├── Containerfile
└── go.mod
```

---

## agent

### 核心职责

1. **Session 生命周期**：在本实例上 Resume/Suspend Session
2. **LLM 推理循环**：接收消息 → 调用 LLM → 执行工具 → 回复
3. **工具路由**：管理每个 Session 的 ToolServiceClient 集合
4. **消息持久化**：直接读写 PostgreSQL messages 表
5. **事件推送**：通过 server-streaming 向 registry 推送实时事件

### ConnectRPC 接口

```
SessionRunnerService（仅供 registry 内部调用）：
  ResumeSession(sessionId, roleId, workerId?) → void
                                    # 建立 MCP 连接，准备处理消息
  SuspendSession(sessionId) → void  # 释放 MCP 连接，保留 DB 状态
  ReceiveMessage(sessionId, content) → void
                                    # 处理新消息（触发 LLM 推理）
  AbortSession(sessionId) → void    # 中断正在运行的推理

  # Role 变更通知（zcp-skill 通过 registry 触发）
  NotifyRoleChanged(sessionId, roleId) → void

  # 事件流（registry 按需订阅）
  ForwardSessionEvents(sessionId) → stream<SessionEvent>
```

### 启动流程

```typescript
async function main() {
  // 1. 初始化 DB 客户端（直连 PostgreSQL via PgBouncer）
  const db = createDBClient(process.env.DATABASE_URL)

  // 2. 向 registry 注册自身
  const registry = new RegistryClient({ baseURL: config.registryURL })
  await registry.login(config.adminToken)
  await registry.register({
    name: config.instanceName,
    instanceType: 'agent',
    ip: config.hostIP,
    port: config.port,
  })

  // 3. 启动心跳
  startHeartbeat(registry, config.instanceId)

  // 4. 启动 ConnectRPC 服务器
  startServer(sessionRunnerService, config.port)
}
```

### Session 内存状态

```typescript
// agent 进程内持有的运行时状态（不持久化）
interface SessionRuntimeState {
  sessionId: string
  state: 'idle' | 'running' | 'compacting'
  toolRouter: ToolRouter            // MCP client 集合 + 工具路由表
  abortController?: AbortController // 用于中断推理
  eventSubscribers: Set<string>     // 当前订阅此 session 的 registry 连接
}
```

### 目录结构

```
agent/
├── src/
│   ├── main.ts
│   ├── api/connect.ts              # ConnectRPC SessionRunnerService 实现
│   ├── service/
│   │   ├── session.ts              # 核心推理循环
│   │   ├── tool-router.ts          # ToolServiceClient 集合 + 路由
│   │   └── state-manager.ts        # 内存 session 状态管理
│   ├── db/
│   │   ├── index.ts                # PostgreSQL 连接（drizzle-orm）
│   │   └── messages.ts             # 消息读写
│   ├── llm/
│   │   └── client.ts               # LLM 调用（ai-proxy 代理）
│   └── event-bus/bus.ts            # 进程内事件总线（推送到 registry stream）
├── Containerfile
└── package.json
```

---

## worker

### 核心职责

1. **WorkerService**：暴露控制接口（GetStatus、GetMCPEndpoints）
2. **filesystem ToolService**：文件系统工具（read/write/edit/glob/grep/ls 等）
3. **execution ToolService**：进程执行工具（job-run/job-list/job-kill/job-output）
4. **进程管理**：全局进程状态（不区分 Session，所有 Session 共享视图）

### ConnectRPC 接口

```
WorkerService：
  GetStatus() → WorkspaceStatus      # 磁盘用量、全局 job 数等
  GetMCPEndpoints() → MCPEndpoints   # filesystem + execution ToolService URL

ToolService（filesystem，端口 15341）：
  ListTools() → tools[]              # read/write/edit/multi-edit/apply-patch/glob/grep/ls
  ExecuteTool(toolName, argsJson, sessionToken) → result
  StreamTool(toolName, argsJson, sessionToken) → stream  # 未来扩展

ToolService（execution，端口 15342）：
  ListTools() → tools[]              # job-run/job-list/job-kill/job-output
  ExecuteTool(toolName, argsJson, sessionToken) → result
  StreamTool(toolName, argsJson, sessionToken) → stream  # job-run 流式输出
```

### 工具列表

**filesystem ToolService：**

| 工具 | 描述 | 关键参数 |
|------|------|---------|
| `read` | 读取文件内容 | path, offset?, limit? |
| `write` | 写入文件 | path, content, createDirs? |
| `edit` | 精确字符串替换 | path, oldString, newString, replaceAll? |
| `multi-edit` | 批量编辑 | path, edits[] |
| `apply-patch` | 应用 unified diff | patch |
| `glob` | 按 glob 模式搜索文件 | pattern, path? |
| `grep` | 正则搜索文件内容 | pattern, path?, include? |
| `ls` | 列出目录内容 | path? |

**execution ToolService：**

| 工具 | 描述 | 关键参数 |
|------|------|---------|
| `job-run` | 运行 shell 命令 | command, args?, cwd?, timeout? |
| `job-list` | 列出所有进程（全局） | — |
| `job-kill` | 终止进程 | processId, signal? |
| `job-output` | 获取进程输出 | processId, stream?, offset?, limit? |

### 环境变量

```bash
WORKSPACE_PORT=15340
FILESYSTEM_MCP_PORT=15341
EXECUTION_MCP_PORT=15342
WORKSPACE_ROOT=/data/worker
REGISTRY_URL=http://localhost:15319
ADMIN_TOKEN=<服务 Token>
INSTANCE_NAME=worker-001
HOST_IP=172.16.11.92
```

---

## zcp-skill

### 核心职责

1. **Role CRUD**：定义 system prompt + MCP server 列表 + skill 列表
2. **Skill CRUD**：Markdown 知识文档管理
3. **Memory 管理**：Agent 持久化记忆（按 agentName 隔离）
4. **Todo 管理**：Session 任务列表（按 sessionId 隔离）
5. **ToolService 暴露**：memory/todo/skill 工具供 agent 调用
6. **Role 变更通知**：Role 更新时通知 registry，registry 转发给 agent

### ConnectRPC 接口

```
RoleLayerService：
  # Role 管理
  CreateRole(slug, name, systemPrompt?, mcpServers?) → role
  UpdateRole(roleId, ...) → role
  DeleteRole(roleId) → void
  GetRole(roleId) → role
  ListRoles() → roles[]
  BindRoleSession(roleId, sessionId) → void  # 记录 session-role 关联（用于变更通知）

  # Skill 管理
  CreateSkill(slug, name, content) → skill
  UpdateSkill(skillId, ...) → skill
  DeleteSkill(skillId) → void
  ListSkills() → skills[]

  # Memory 管理（直接访问 PostgreSQL）
  WriteMemory(agentName, filename, content) → void
  ReadMemory(agentName, filename) → entry
  ListMemory(agentName) → entries[]
  DeleteMemory(agentName, filename) → void

ToolService（端口 15320，路径前缀 /mcp）：
  ListTools() → [memory-write, memory-read, memory-list, todo-write, todo-read, skill-get]
  ExecuteTool(toolName, argsJson, sessionToken) → result
```

### memory/todo 的 identity 提取

ToolService 中的 memory/todo 工具通过 `sessionToken`（JWT）提取调用身份：

```go
// 从 JWT 中提取 agentName 和 sessionId
func extractIdentity(sessionToken string) (agentName, sessionId string, err error) {
    claims, err := verifyJWT(sessionToken)
    // agentName 来自 claims.Sub（service JWT 的 subject）
    // sessionId 来自 HTTP header X-Session-Id（单独传递）
}
```

---

## channel

### 核心职责

1. **聊天室管理**：创建/成员/消息收发（存 PostgreSQL）
2. **文件上传**：写入 Garage S3，返回直链 URL
3. **事件发布/订阅**：SSE 实时推送
4. **@mention 触发**：检测到 @mention 调用 `registry.RouteNotify()`
5. **ToolService 暴露**：chatroom 工具供 agent 调用

### ConnectRPC 接口

```
ChannelService：
  # 聊天室
  CreateChatroom(name) → chatroom
  ListChatrooms() → chatrooms[]
  AddMember(chatroomId, memberId, memberType) → void
  RemoveMember(chatroomId, memberId) → void
  SendMessage(chatroomId, senderId, content, mentions?, attachments?) → message
  GetMessageHistory(chatroomId, limit?, before?) → messages[]

  # 文件上传
  UploadFile(filename, content, mimeType) → fileUrl

  # 事件订阅
  SubscribeMessages(chatroomId) → stream<ChatroomMessage>

ToolService（/mcp/chatroom）：
  ListTools() → [chatroom-info, chatroom-message-read, chatroom-message-send]
  ExecuteTool(toolName, argsJson, sessionToken) → result
```

### chatroom-message-send 的文件附件

在新架构中，LLM 需要发送文件时：
1. 先调用 filesystem ToolService 的 `read` 工具读取文件内容（base64）
2. 再调用 chatroom ToolService 的 `chatroom-message-send`，传入 base64 内容
3. chatroom ToolService 内部调用 channel 的 `UploadFile()` 上传到 Garage，返回 URL
4. 用 URL 发送消息

---

## ai-proxy

### 核心职责

1. OpenAI 兼容的 `/v1/chat/completions` 代理透传
2. **Provider 模板**：从 `models.dev` 动态获取 110+ 提供商和 4000+ 模型元数据
3. **ProviderModelConfig CRUD**：存储用户配置的上游 LLM 连接（URL + 用户 API Key + 能力标志）
4. **Proxy CRUD**：对外代理端点，自动生成 `cpk_` API Key
5. 流式/非流式输出支持
6. 调用日志 + token 统计（存 PostgreSQL）

### ConnectRPC 接口

```
AiProxyService（14 个方法）：
  # Proxy CRUD
  ListProxies(enabledOnly?) → { proxies[] }
  GetProxy(id) → ProxyInfo
  CreateProxy(sourceModel, providerModelConfigId) → ProxyInfo
  UpdateProxy(id, sourceModel?, providerModelConfigId?, enabled?) → ProxyInfo
  DeleteProxy(id) → {}

  # ProviderModelConfig CRUD
  ListProviderModelConfigs(enabledOnly?) → { configs[] }
  GetProviderModelConfig(id) → ProviderModelConfigInfo
  CreateProviderModelConfig(providerId, modelId, upstream, apiKey, ...) → ProviderModelConfigInfo
  UpdateProviderModelConfig(id, ...) → ProviderModelConfigInfo
  DeleteProviderModelConfig(id) → {}

  # Provider 模板（从 models.dev 动态获取）
  ListProviders() → { providers[] }
  ListProviderModels(providerId) → { models[] }

  # 日志/统计
  QueryLogs(proxyId?, fromTs?, toTs?, limit?, offset?) → { logs[], total }
  GetTokenStats(proxyId?, fromTs?, toTs?) → { totalInputTokens, totalOutputTokens, totalTokens, requestCount }
```

### 数据模型

| 实体 | 表名 | 说明 |
|------|------|------|
| ProviderModelConfig | `ai_proxy_provider_model_configs` | 上游提供商连接配置（URL + 用户 API Key + 能力标志） |
| Proxy | `ai_proxy_proxies` | 对外代理端点（sourceModel 别名 + 自动 cpk_ Key） |
| Log | `ai_proxy_logs` | Append-only 调用审计日志 |

### 认证流程

```
1. 客户端：POST /v1/chat/completions, Authorization: Bearer cpk_xxx, body.model = "my-gpt-4o"
2. ai-proxy 查询：proxy JOIN provider_model_config WHERE sourceModel = "my-gpt-4o" AND apiKey = "cpk_xxx"
3. 使用 provider_model_config.apiKey 转发到上游 LLM 提供商
4. 客户端永远看不到真实的上游 API Key
```

### 与 OpenZergNeo ai-proxy 的差异

| 维度 | ai-proxy（旧） | ai-proxy（新） |
|------|------------|-------------|
| 提供商配置 | 硬编码 | **models.dev 动态模板** |
| 数据模型 | 单一 Provider | **ProviderModelConfig + Proxy 分离** |
| API Key | 手动设置 | **自动生成 cpk_ Key** |
| 权限系统 | Permission + agentName | **已移除**，proxy apiKey 即可 |
| API 路由 | 手写 HTTP REST | **ConnectRPC** |
| 生成代码 | 本地 gen/ | **common-spec 统一生成** |

### 环境变量

```bash
AI_PROXY_PORT=15316
AI_PROXY_HOST=0.0.0.0
DATABASE_URL=postgresql://openzerg:${DB_PASSWORD}@localhost:5433/openzerg
REGISTRY_URL=http://localhost:15319   # 可选，用于服务注册
ADMIN_TOKEN=<管理员 Token>              # 可选，用于 registry 注册
```

---

## 公共环境变量

所有服务均需设置：

```bash
DATABASE_URL=postgresql://openzerg:${DB_PASSWORD}@localhost:5433/openzerg
REGISTRY_URL=http://localhost:15319
ADMIN_TOKEN=<服务向 registry 登录的 API Key>
HOST_IP=172.16.11.92
JWT_SECRET=<与 registry 共享的 JWT 密钥，用于验证 token>
```
