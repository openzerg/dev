# agent

Agent 服务。提供 LLM Agent 循环：流式推理 + 工具调用 + 自动压缩。Agent 是无状态的，所有状态通过 Registry DB 在运行时解析。

## 架构

```
chat(sessionId, content)
  → loadRole(sessionId)         → ProviderResolver → DB/ai-proxy
  → buildTools(sessionId)       → ToolResolver → DB → ToolRouter → ZCP 服务
  → buildSystemParts()          → system[0] = role prompt, system[1] = ZCP systemContext
  → stream(messages, tools)     → LLM 流式响应
  → executeTool(name, args)     → ToolRouter → ZCP 服务 → Worker
  → autoCompact()               → prune + summarize
```

## ConnectRPC 接口

| 方法 | 功能 |
|------|------|
| `Chat` | 发送消息（异步，返回后 Agent 在后台运行） |
| `Interrupt` | 中断当前运行 |
| `DeleteMessagesFrom` | 删除指定消息及其之后的所有消息 |
| `SwitchRole` | 切换角色（注入 `<system-reminder>`） |
| `SubscribeSessionEvents` | SSE 流式事件（response/tool_call/tool_result/done/error） |
| `Health` | 健康检查 |

## 关键设计

- **2-part system prompt**：`system[0]` = 角色固定 prompt，`system[1]` = ZCP 动态上下文
- **SwitchRole**：切换角色时注入 `<system-reminder>` 到下一条 user 消息
- **Auto-compaction**：先 prune（保护最近 40K token 的工具输出），再 summarize（LLM 总结）
- **Neverthrow**：所有 service 层返回 `ResultAsync<T, AppError>`

## 技术栈

| 属性 | 值 |
|------|-----|
| 运行时 | Bun |
| RPC | ConnectRPC v2 |
| 数据库 | PostgreSQL（Kysely + postgres.js） |
| LLM | OpenAI SDK（兼容多提供商，通过 ai-proxy） |
| 错误处理 | neverthrow Result monad |
| API 定义 | common-spec（TypeSpec → proto） |

## 目录结构

```
agent/
├── src/
│   ├── main.ts               # 入口：HTTP 服务器 + DB + AgentLoop
│   ├── config.ts             # 环境变量
│   ├── router.ts             # ConnectRPC 路由（AgentService）
│   ├── db/index.ts           # Kysely 初始化
│   ├── event-bus/index.ts    # SSE 事件总线
│   ├── llm/                  # LLM 客户端（stream + complete）
│   └── service/
│       ├── agent-loop.ts     # 主循环（ResultAsync 封装）
│       ├── compaction.ts     # 自动压缩（prune + summarize）
│       ├── message-builder.ts # 消息构建（2-part system prompt）
│       ├── message-store.ts  # 消息持久化
│       ├── provider-resolver.ts # 提供商解析（DB / ai-proxy）
│       ├── session-state.ts  # 会话状态管理
│       ├── tool-manager.ts   # 工具管理（build + execute）
│       └── tool-resolver.ts  # ZCP 服务器发现（ResultAsync）
├── Containerfile
├── package.json
└── tsconfig.json
```

## 环境变量

```bash
DATABASE_URL=postgresql://openzerg:${DB_PASSWORD}@localhost:5433/openzerg
AGENT_PORT=15331
AI_PROXY_URL=http://localhost:15316     # 可选，通过 RPC 解析 provider
REGISTRY_URL=http://localhost:15319     # 可选，直接 DB 查询 fallback
```

## 开发

```bash
bun install && bun run typecheck && bun run dev
```
