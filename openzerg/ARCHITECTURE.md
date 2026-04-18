# OpenZergUltra 系统架构

## 目录

1. [设计哲学](#1-设计哲学)
2. [服务命名与职责](#2-服务命名与职责)
3. [系统全景](#3-系统全景)
4. [核心概念模型](#4-核心概念模型)
5. [服务架构详解](#5-服务架构详解)
6. [技术栈](#6-技术栈)
7. [通信层设计](#7-通信层设计)
8. [数据层设计](#8-数据层设计)
9. [工具系统设计](#9-工具系统设计)
10. [Session 生命周期](#10-session-生命周期)
11. [注册发现与鉴权](#11-注册发现与鉴权)
12. [与 OpenZergNeo 的对比](#12-与-openzergneo-的对比)

---

## 1. 设计哲学

### Session 是第一公民

OpenZergNeo 以 Agent 容器（mutalisk）为管理单元，每个 agent 绑定固定的 Role 和 Workspace。

OpenZergUltra 将管理粒度下移到 **Session**：

- 每个 Session 独立选择底层 **Worker**（文件系统/执行环境 pod）
- 每个 Session 独立选择中层 **Role**（system prompt + 可用工具集）
- 同一个 Agent 实例可并发运行使用不同 Role 和不同 Worker 的多个 Session

### 工具系统完全插件化

Agent（运行时）本身**零内置工具**。所有工具通过 ConnectRPC **ToolService** 协议从外部服务获取：

- Worker 提供文件系统和进程执行工具
- Zcp-Skill 提供 memory、todo、skill 工具
- Channel 提供 chatroom 工具
- 任何实现了 ToolService 的服务都可以注册到 Role 配置中

### 强类型从定义出发

TypeSpec 是所有 API 的**唯一真相来源**：

```
TypeSpec (.tsp)
  ↓ tsp compile
.proto → buf generate → TS stubs（连接所有服务）
JSON Schema → zod 验证（工具参数运行时强类型）
```

### 无状态的 Agent 层

Agent 水平可扩展，任意实例可 Resume 任意 Session，状态全部持久化在 PostgreSQL。

---

## 2. 服务命名与职责

> **命名来源**：Zerg 星际单位体系

| 服务 | Zerg 单位 | 类比 OpenZergNeo | 职责 |
|------|---------|----------------|------|
| **registry** | 巨兽（最大控制单位） | cerebrate | 服务注册中心、JWT 鉴权、Session 路由、Worker 生命周期管理 |
| **agent** | 脑虫（Zerg 智慧核心） | mutalisk | Agent 运行时：Session 调度、LLM 推理、工具调用 |
| **worker** | 工蜂（执行具体工作） | mutalisk（文件部分）| Workspace pod：文件系统 + 进程执行 ToolService |
| **zcp-skill** | 进化舱（赋予能力） | evo-chamber | Role/Skill/Memory/Todo + ToolService |
| **channel** | 虫道（传输通信） | nydus | 消息总线 + Chatroom ToolService |
| **ai-proxy** | 菌毯（基础设施层） | pylon | LLM 代理（OpenAI 兼容） |
| **overmind-webui** | 大脑之眼 | overmind-webui | 管理控制台（SolidJS） |
| **common-spec** | — | common-node + common-go | TypeSpec API 定义 + TS client（唯一真相） |

---

## 3. 系统全景

### 部署拓扑

```
外网用户 / WebUI
    │ HTTPS（仅 :8080）
    ▼
┌──────────────────────────────────────────────────────────────────┐
│  nginx :8080  （唯一对外入口）                                     │
│  /_api/registry/*     → registry :15319                          │
│  /_api/zcp-skill/*    → zcp-skill :15320                         │
│  /_api/channel/*      → channel :15318                           │
│  /_api/ai-proxy/*     → ai-proxy :15316                          │
│  /                    → overmind-webui（静态文件）                  │
└────────────────────────┬─────────────────────────────────────────┘
                         │ 用户 JWT
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  registry :15319  [ConnectRPC]                                 │
│                                                                 │
│  职责：                                                          │
│  ① 颁发和验证 JWT（用户 JWT + 服务间 service JWT）               │
│  ② 所有服务实例注册与心跳管理（instances 表）                    │
│  ③ Session CRUD（存 PostgreSQL）                                │
│  ④ Chat() 路由 → 找到正确的 agent 实例转发                       │
│  ⑤ Worker pod 生命周期管理（Podman API）                        │
│  ⑥ Channel @mention 路由（RouteNotify）                        │
│  ⑦ 事件中继（按需将 agent 事件流转发给 WebUI）                   │
└──────────┬──────────────────────────────────────────────────────┘
           │ service JWT（内部服务间通信）
           │
    ┌──────┴──────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
┌──────────────────────┐              ┌──────────────────────┐
│  agent :15330+       │              │  zcp-skill :15320    │
│  （多实例，水平扩展） │              │                      │
│                      │              │  ConnectRPC（管理）  │
│  职责：              │              │  ToolService（工具）  │
│  Session 调度        │◄─────────────│  memory/todo/skill   │
│  LLM 推理循环        │  ToolService │                      │
│  工具路由（ToolRouter）              └──────────────────────┘
│  消息历史读写（PG）  │
│  事件推送            │              ┌──────────────────────┐
│                      │◄─────────────│  worker :15340+      │
│  零内置工具           │  ToolService │  （每个 Workspace    │
│  全部通过 ToolService │              │   一个实例）          │
└──────────────────────┘              │                      │
                                      │  filesystem tools    │
                                      │  execution tools     │
                                      └──────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐
│  channel :15318  │    │  ai-proxy :15316 │    │  PostgreSQL  │
│                  │    │                  │    │  (PgBouncer) │
│  ConnectRPC      │    │  LLM 代理        │    │              │
│  ToolService     │    │  Provider 模板   │    │  所有持久化  │
│  chatroom tools  │    │  OpenAI 兼容     │    │  状态        │
└─────────────────┘    └─────────────────┘    └──────────────┘
```

### 数据流概览

```
用户发送消息：
  WebUI → nginx → registry.Chat(sessionId, content)
    → registry 查 PostgreSQL 找到持有该 session 的 agent 实例
    → registry → agent-X.ReceiveMessage(sessionId, content)
    → agent 写消息到 PostgreSQL，进入 LLM 推理循环
    → LLM 返回 tool_call "read" {"path":"./src/main.ts"}
    → agent 查 ToolRouter：read → worker-001.ToolService
    → agent → worker-001.ExecuteTool("read", argsJson, sessionToken)
    → worker 路径安全检查，执行 fs.readFile，返回内容
    → agent 将结果写入 PostgreSQL messages，继续推理循环
    → 推理完成，事件流通过 registry 转发给 WebUI
```

---

## 4. 核心概念模型

### 三层结构

```
┌─────────────────────────────────────────────────────────┐
│  中层：Role（能力配置，由 zcp-skill 管理）                │
│  - system prompt（决定 agent 的行为模式）                 │
│  - ToolService URL 列表（决定可用工具集）                │
│  - skill 列表（可注入的知识文档）                        │
│                                                          │
│  示例 Role：                                             │
│    plan：分析规划 prompt + memory + web-search           │
│    build：代码开发 prompt + filesystem + execution       │
│    chat：对话 prompt + chatroom + memory                 │
└──────────────────────────┬──────────────────────────────┘
                           │ Session 创建时选择
┌──────────────────────────▼──────────────────────────────┐
│  Session（管理单元，registry 管元数据，agent 执行）       │
│  - roleId：绑定 Role（可实时更新，agent 重建工具路由）    │
│  - workerId：绑定 Worker pod（可选，无则无文件系统工具）  │
│  - 消息历史（存 PostgreSQL messages 表）                 │
│  - 状态：idle / running / compacting / suspended        │
└──────────────┬─────────────────────────────┬────────────┘
               │ 可选绑定                      │ Role 决定
┌──────────────▼──────────────┐  ┌───────────▼────────────┐
│  底层：Worker（执行环境 pod）│  │  ToolService 端点集合   │
│  - 挂载 /data/workspace      │  │  worker.filesystem     │
│  - filesystem ToolService    │  │  worker.execution      │
│  - execution ToolService     │  │  zcp-skill.memory      │
│  - 跨 Session 共享，持久化   │  │  zcp-skill.todo        │
│  - 进程状态全局可见           │  │  channel.chatroom      │
└─────────────────────────────┘  │  （外部自定义 server）  │
                                  └────────────────────────┘
```

---

## 5. 服务架构详解

### registry（注册中心 + 鉴权 + 路由）

**端口**：15319 | **语言**：TypeScript/Bun

职责：
- JWT 颁发与验证（用户 JWT + service JWT）
- 所有服务实例注册与心跳（agent × N、worker × N、zcp-skill、channel、ai-proxy）
- Session 元数据 CRUD（存 PostgreSQL）
- `Chat(sessionId, content)` → 路由到正确 agent 实例
- Worker pod 生命周期（Podman API）
- Channel @mention → `RouteNotify` → 找到或创建 agent session
- WebUI `SubscribeSessionEvents` → 按需从 agent 中继事件流

---

### agent（运行时）

**端口**：15330+（多实例）| **语言**：TypeScript/Bun

职责：
- Session Resume/Suspend（从 PostgreSQL 加载历史，建立 ToolRouter）
- LLM 推理循环（消息 → LLM → tool_call → ToolService → 结果 → LLM）
- ToolRouter：管理每个 Session 的 ToolServiceClient 集合
- 消息直接读写 PostgreSQL（不经 registry 代理）
- 事件推送（server-streaming → registry → WebUI）

**内置工具**：**零**
**工具来源**：从 Role.mcpServers 列表 + Worker ToolService 动态加载

---

### worker（Workspace 执行环境）

**端口**：15340+（每个 Workspace 一个）| **语言**：TypeScript/Bun

职责：
- **filesystem ToolService**（:15341）：read/write/edit/glob/grep/ls
- **execution ToolService**（:15342）：job-run/job-list/job-kill/job-output
- 路径沙箱：所有文件操作强制限定在 `/data/workspace`
- 进程管理：全局可见，不区分 Session
- WorkspaceService ConnectRPC：GetStatus / GetMCPEndpoints

---

### zcp-skill（能力管理）

**端口**：15320 | **语言**：TypeScript/Bun

职责：
- Role CRUD（mcpServers URL 列表、skill 引用、system prompt）
- Skill CRUD（Markdown 文档）
- Memory CRUD（按 agentName 隔离）
- Todo CRUD（按 sessionId 隔离）
- **ToolService** 暴露：memory / todo / skill 工具
- Role 变更时通知 registry → 分发给相关 agent 实例重建 ToolRouter

---

### channel（消息总线）

**端口**：15318 | **语言**：TypeScript/Bun

职责：
- 聊天室 CRUD + 消息收发
- 文件上传（Garage S3）
- @mention 检测 → 调用 `registry.RouteNotify()`
- **ToolService** 暴露：chatroom-info / chatroom-message-read / chatroom-message-send

---

### ai-proxy（LLM 代理）

**端口**：15316 | **语言**：TypeScript/Bun

职责：
- OpenAI 兼容 `/v1/chat/completions` 代理透传
- **Provider 模板**：从 `models.dev` 动态获取 110+ 提供商和 4000+ 模型元数据
- **ProviderModelConfig**：存储用户配置的上游 LLM 提供商连接（URL + 用户 API Key + 能力标志）
- **Proxy**：对外代理端点，自动生成 `cpk_` API Key，客户端无需接触真实上游 Key
- 流式/非流式输出支持
- 调用日志 + token 统计（存 PostgreSQL）
- ConnectRPC 管理接口（14 个方法：Proxy CRUD、ProviderModelConfig CRUD、模板查询、日志/统计）

与 OpenZergNeo pylon 的关键差异：
- 移除了 Permission 权限系统（改为 proxy apiKey 认证）
- ProviderModelConfig + Proxy 数据模型分离（而非单一 Provider 实体）
- Provider 模板从 models.dev 动态获取（而非硬编码）
- 全部 API 迁移到 ConnectRPC（非手写 HTTP REST）
- 零本地生成代码，全部从 `@openzerg/common`（common-spec）导入

---

## 6. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **全栈语言** | TypeScript + Bun | 第一版全 TS，Go 等性能瓶颈出现再迁移 |
| **API 定义** | TypeSpec 1.11.0 | 唯一真相来源，生成 proto + JSON Schema |
| **RPC 框架** | ConnectRPC | HTTP/2，JSON 模式可 curl 调试 |
| **代码生成** | buf | proto → TS stubs |
| **数据库** | PostgreSQL 17 + PgBouncer | 全局共享，连接池 |
| **对象存储** | Garage v2（S3 兼容）| 仅文件上传 |
| **容器运行时** | Podman | worker/agent 容器管理 |
| **前端框架** | SolidJS + @suid/material | WebUI |
| **前端路由** | @solidjs/router | |
| **构建工具** | Vite（webui）/ bun build（服务）| |

---

## 7. 通信层设计

### 外部通信（用户 → 系统）

```
WebUI → nginx :8080 → registry（仅此一条外部通道）
所有请求携带用户 JWT：Authorization: Bearer <userJWT>
```

### 内部通信（服务间）

```
registry → agent      service JWT，ReceiveMessage / ResumeSession
registry → worker     service JWT，SpawnWorker / GetStatus
agent → worker        service JWT + sessionToken，ToolService
agent → zcp-skill     service JWT + sessionToken，ToolService
agent → channel       service JWT + sessionToken，ToolService
agent → ai-proxy      service JWT，/v1/chat/completions
registry → zcp-skill  service JWT，GetRole / ListRoles（管理接口）
```

### ToolService 协议（核心工具调用）

所有工具服务实现同一个 ConnectRPC 接口：

```protobuf
service ToolService {
  rpc ListTools(ListToolsRequest) returns (ListToolsResponse);
  rpc ExecuteTool(ExecuteToolRequest) returns (ExecuteToolResponse);
  rpc StreamTool(ExecuteToolRequest) returns (stream ToolOutputChunk);
}

message ExecuteToolRequest {
  string tool_name = 1;
  string args_json = 2;       // 符合 JSON Schema 的参数
  string session_token = 3;   // 用户 JWT（透传，用于身份提取）
}
```

---

## 8. 数据层设计

### 存储分工

| 数据 | 存储 | 读写者 |
|------|------|--------|
| Session 元数据 | PostgreSQL | registry（CRUD）、agent（状态更新）|
| 消息历史 | PostgreSQL | agent（直接读写）|
| 服务实例注册 | PostgreSQL | registry |
| Role/Skill 定义 | PostgreSQL | zcp-skill |
| Memory/Todo | PostgreSQL | zcp-skill（通过 ToolService）|
| 聊天室消息 | PostgreSQL | channel |
| LLM 调用日志 | PostgreSQL | ai-proxy |
| Provider 配置 | PostgreSQL | ai-proxy |
| 文件附件 | Garage S3 | channel |
| Worker 进程状态 | worker 内存 | worker（不持久化）|

### 关键表

```sql
instances      -- 所有服务实例（registry / agent × N / worker × N）
sessions       -- Session 元数据（roleId, workerId, runner_instance_id）
messages       -- Session 消息历史（append-only，每行一条）
workspaces     -- Worker pod 元数据（filesystem_url, execution_url）
roles          -- Role 定义（system_prompt, mcp_servers[]）
role_mcp_servers -- Role 关联的 ToolService URL 配置
memory         -- Agent 持久化记忆
todos          -- Session 任务列表
chatrooms / chatroom_messages / chatroom_members
creep_provider_model_configs / creep_proxies / creep_logs
```

---

## 9. 工具系统设计

### 工具路由建立（agent Session Resume 时）

```
agent.ResumeSession(sessionId, roleId, workerId?)
  │
  ├── 1. 查 PostgreSQL 获取 Role 配置
  │     role.mcpServers = [
  │       { name:"memory",   url:"http://localhost:15320/mcp" },
  │       { name:"chatroom", url:"http://localhost:15318/mcp" },
  │     ]
  │
  ├── 2. 如有 workerId，查 workspaces 表获取 worker URL
  │     { filesystemUrl:"http://HOST:15341", executionUrl:"http://HOST:15342" }
  │
  ├── 3. 为每个 URL 创建 ToolServiceClient，调用 ListTools()
  │
  ├── 4. 构建 ToolRouter（同名工具按 priority 取最高）
  │
  └── 5. 构建 LLM tools 数组（每个工具的 JSON Schema 发给 LLM）
```

### 安全防护

- **URL 白名单**：ToolService URL 全部来自 PostgreSQL（管理员配置），LLM 无法注入新 URL
- **路径沙箱**：worker 服务端验证所有路径不超出 `/data/workspace`
- **网络隔离**：worker 容器使用隔离网络，执行的命令无法访问内部服务
- **速率限制**：registry 对每个 session 限制工具调用频率

---

## 10. Session 生命周期

```
CreateSession(roleId, workerId?)           [registry]
  → 写 PostgreSQL sessions 表
  → 选择负载最低的 agent 实例
  → agent.ResumeSession() 建立 ToolRouter
  → state: idle

Chat(sessionId, content)                  [registry → agent]
  → state: running
  → LLM 推理循环（工具调用 × N）
  → state: idle

Role 变更 → zcp-skill 通知 registry
  → registry → 相关 agent.NotifyRoleChanged()
  → agent 重建 ToolRouter（实时生效）

超时不活跃 → state: suspended
  → 保留 workerId 绑定
  → agent 内存状态清理

下次 Chat() → registry 重新分配 agent 实例
  → agent 从 PostgreSQL 加载历史，重建 ToolRouter

DeleteSession() → 解除 worker 绑定，清理 PostgreSQL 记录
```

---

## 11. 注册发现与鉴权

详见 [docs/security.md](docs/security.md)

核心要点：
1. **registry 是唯一鉴权中心**，颁发用户 JWT 和 service JWT
2. **service JWT 权限受限**（permissions 字段），agent 只能调用 ToolService，不能做管理操作
3. **ToolService URL 白名单**：只连接 PostgreSQL 中存储的 URL，LLM 无法注入
4. **worker 网络隔离**：容器级别，执行命令无法访问内部服务

---

## 12. 与 OpenZergNeo 的对比

| 维度 | OpenZergNeo | OpenZergUltra |
|------|------------|---------------|
| **管理单元** | Agent 容器（mutalisk）| **Session** |
| **注册中心** | cerebrate（Go）| **registry**（TS/Bun）|
| **Agent 运行时** | mutalisk（TS/Bun）| **agent**（TS/Bun）|
| **工具内置** | mutalisk 内置 23 个工具 | agent **零内置工具** |
| **工具协议** | 私有 ExternalTool HTTP | **ConnectRPC ToolService**（统一强类型）|
| **工具参数类型** | 无 | **JSON Schema（TypeSpec 生成）**|
| **Role 粒度** | Agent 级别（固定）| **Session 级别（可实时切换）**|
| **Workspace** | Agent 容器内目录 | **独立 worker pod，持久化，跨 Session 共享**|
| **数据库** | 各服务独立 SQLite | **全局 PostgreSQL + PgBouncer**|
| **API 定义** | 手写 proto（两套手动同步）| **TypeSpec 单一来源**|
| **语言** | Go + TypeScript 混合 | **全 TypeScript/Bun**（第一版）|
| **水平扩展** | mutalisk 容器 × N | **agent 无状态 × N**|
