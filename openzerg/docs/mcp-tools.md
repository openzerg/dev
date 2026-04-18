# 工具系统详细设计

## 概述

OpenZergUltra 的工具系统基于 **ConnectRPC ToolService 协议**，是对 MCP（Model Context Protocol）的替代设计。核心差异：

| | MCP | OpenZergUltra ToolService |
|--|-----|--------------------------|
| 传输层 | HTTP/SSE（StreamableHTTP） | ConnectRPC（HTTP/2） |
| 类型定义 | JSON Schema（手写） | TypeSpec 生成 JSON Schema |
| 服务接口 | JSON-RPC 2.0 | ConnectRPC proto（强类型） |
| 生态兼容 | 兼容公共 MCP 生态 | 自有生态，不兼容公共 MCP |
| 流式支持 | SSE | ConnectRPC server-streaming |

---

## ToolService 协议

所有工具服务（worker、zcp-skill、channel）必须实现 `ToolService`：

```protobuf
// 由 TypeSpec 从 specs/tools/tool-service.tsp 生成
service ToolService {
  rpc ListTools(ListToolsRequest) returns (ListToolsResponse);
  rpc ExecuteTool(ExecuteToolRequest) returns (ExecuteToolResponse);
  rpc StreamTool(ExecuteToolRequest) returns (stream ToolOutputChunk);
}
```

---

## 工具定义规范（TypeSpec）

### 一个工具的完整定义

以 `read` 工具为例：

```typescript
// specs/tools/filesystem.tsp

import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace FilesystemTools {

  /** 读取文件或目录内容 */
  @doc("Read a file or directory. Returns file contents with line numbers.")
  model ReadArgs {
    /** 文件路径，相对于 worker 根目录 */
    path: string;

    /** 起始行号（1-indexed）。用于读取大文件的指定部分。 */
    @minValue(1)
    offset?: int32;

    /** 最大读取行数，默认 2000 */
    @minValue(1) @maxValue(10000)
    limit?: int32;
  }

  model ReadResult {
    /** 文件内容（含行号前缀） */
    content: string;

    /** 是否被截断（文件行数超过 limit） */
    truncated: boolean;

    /** 文件总行数 */
    totalLines: int32;
  }
}
```

生成的 `ReadArgs.json`：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "path":   { "type": "string", "description": "文件路径..." },
    "offset": { "type": "integer", "minimum": 1 },
    "limit":  { "type": "integer", "minimum": 1, "maximum": 10000 }
  },
  "required": ["path"]
}
```

### 工具注册（worker 服务内部）

```typescript
// zcp-fs/src/tools/read.ts

import { z } from 'zod'
import { defineTool } from '../lib/tool-sdk.ts'
import ReadArgsSchema from '../../generated/schemas/tools/ReadArgs.json' with { type: 'json' }

export const readTool = defineTool({
  name: 'read',
  description: 'Read a file or directory...',
  inputSchemaJson: JSON.stringify(ReadArgsSchema),
  outputSchemaJson: JSON.stringify(ReadResultSchema),
  group: 'filesystem',
  priority: 0,

  // zod schema 与 TypeSpec 模型对应
  argsSchema: z.object({
    path: z.string(),
    offset: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(10000).optional(),
  }),

  async execute(args, context) {
    const fullPath = resolve(context.workerRoot, args.path)

    // 路径安全检查
    if (!fullPath.startsWith(context.workerRoot)) {
      return { success: false, error: 'Path outside worker', resultJson: '' }
    }

    const content = await readFileWithLineNumbers(fullPath, args.offset, args.limit)
    return {
      success: true,
      resultJson: JSON.stringify({ content, truncated: content.truncated, totalLines: content.totalLines }),
    }
  }
})
```

---

## 完整工具列表

### Filesystem ToolService（zcp-fs）

| 工具名 | 描述 | 主要参数 | 流式 |
|--------|------|---------|------|
| `read` | 读取文件或目录 | path, offset?, limit? | 否 |
| `write` | 写入/覆盖文件 | path, content, createDirs? | 否 |
| `edit` | 精确字符串替换 | path, oldString, newString, replaceAll? | 否 |
| `multi-edit` | 批量精确替换 | path, edits[{oldString,newString}] | 否 |
| `apply-patch` | 应用 unified diff | patch | 否 |
| `glob` | 按 glob 模式搜索文件 | pattern, path? | 否 |
| `grep` | 正则搜索文件内容 | pattern, path?, include?, maxResults? | 否 |
| `ls` | 列出目录 | path? | 否 |

### Execution ToolService（zcp-job）

| 工具名 | 描述 | 主要参数 | 流式 |
|--------|------|---------|------|
| `job-run` | 运行 shell 命令 | command, args?, cwd?, timeout?, env? | **是** |
| `job-list` | 列出所有进程（全局） | — | 否 |
| `job-kill` | 终止进程 | processId, signal? | 否 |
| `job-output` | 获取进程输出 | processId, stream?, offset?, limit? | 否 |

> `job-list` 展示 worker 上所有进程，不区分 Session 来源。

### Skill ToolService（zcp-skill）

| 工具名 | 描述 | 主要参数 | identity 来源 |
|--------|------|---------|--------------|
| `memory-write` | 写入持久化记忆 | filename, content | agentName from JWT |
| `memory-read` | 读取持久化记忆 | filename | agentName from JWT |
| `memory-list` | 列出记忆文件 | — | agentName from JWT |
| `todo-write` | 更新任务列表 | todos[{content,status,priority}] | sessionId from header |
| `todo-read` | 读取任务列表 | — | sessionId from header |
| `skill-get` | 获取 skill 内容 | skillSlug | — |

> `skill-get` 用于将 skill 的 Markdown 内容注入为 LLM 的额外上下文（system message）。

### Chatroom ToolService（channel）

| 工具名 | 描述 | 主要参数 | identity 来源 |
|--------|------|---------|--------------|
| `chatroom-info` | 获取聊天室信息和成员列表 | chatroomId? | externalId from session |
| `chatroom-message-read` | 读取聊天室历史消息 | chatroomId?, limit?, before? | — |
| `chatroom-message-send` | 发送聊天室消息 | content, mentions?, attachmentBase64?, attachmentName? | senderId from JWT |

---

## agent 工具路由详细流程

### Session 创建时（建立路由表）

```
CreateSession(roleId="build", workerId="ws-001")
  │
  ├── 从 PostgreSQL 读取 role "build" 配置：
  │     mcpServers: [
  │       { name:"filesystem", url:"http://ws-001:15341", priority:10 },
  │       { name:"execution",  url:"http://ws-001:15342", priority:10 },
  │     { name:"memory",     url:"http://zcp-skill:15320/mcp", priority:5 },
  │     { name:"todo",       url:"http://zcp-skill:15320/mcp", priority:5 },
  │     ]
  │
  ├── 为每个 url 创建 ToolServiceClient：
  │     filesystemClient = new ToolServiceClient("http://ws-001:15341")
  │     executionClient  = new ToolServiceClient("http://ws-001:15342")
  │     roleLayerClient  = new ToolServiceClient("http://zcp-skill:15320/mcp")
  │
  ├── 调用 ListTools() 获取工具定义：
  │     filesystemClient.listTools() → [read, write, edit, glob, grep, ls, ...]
  │     executionClient.listTools()  → [job-run, job-list, job-kill, job-output]
  │     roleLayerClient.listTools()  → [memory-write, memory-read, ..., todo-write, todo-read]
  │
  ├── 构建路由表（同名工具取高 priority）：
  │     toolRouter = {
  │       "read":         filesystemClient (priority=10),
  │       "write":        filesystemClient (priority=10),
  │       "grep":         filesystemClient (priority=10),
  │       "job-run":      executionClient  (priority=10),
  │       "memory-write": roleLayerClient  (priority=5),
  │       "todo-write":   roleLayerClient  (priority=5),
  │       ...
  │     }
  │
  └── 构建 LLM 工具列表：
        [{ type:"function", function:{name:"read", parameters: ReadArgs.json} }, ...]
```

### LLM 推理时（工具执行）

```
LLM 返回：{ tool_calls: [{ id:"c1", name:"read", arguments:'{"path":"./src/main.ts"}' }] }
  │
  ├── toolRouter.execute("read", '{"path":"./src/main.ts"}', sessionJWT)
  │     → filesystemClient.executeTool({
  │         toolName: "read",
  │         argsJson: '{"path":"./src/main.ts"}',
  │         sessionToken: sessionJWT
  │       })
  │
  ├── worker 收到请求：
  │     1. 解析 argsJson
  │     2. zod 验证（ReadArgsSchema.parse）
  │     3. 执行 fs.readFile(...)
  │     4. 返回 ExecuteToolResponse {
  │          resultJson: '{"content":"1: import...\n2: ...","truncated":false,"totalLines":150}',
  │          success: true
  │        }
  │
  └── agent 将结果存入 PostgreSQL messages 表：
        role="tool", toolName="read", content=resultJson, toolCallId="c1"
      → 将 resultJson 作为 tool message 内容返回给 LLM
```

### Role 实时变更（重建路由表）

```
Admin 在 WebUI 为 "build" role 添加 web-search MCP server
  │
  ├── zcp-skill 更新 PostgreSQL role_mcp_servers 表
  ├── zcp-skill 查询：哪些 session 正在使用 role "build"？
  │     SELECT session_id FROM sessions WHERE role_id = "build" AND state != "deleted"
  ├── zcp-skill 调用 agent.NotifyRoleChanged("build")
  ├── agent 找到持有这些 session 的 runner 实例
  └── agent 调用 runner.NotifyRoleChanged(sessionId, "build")
        → runner 为该 Session 重建 ToolRouter（含新的 web-search client）
        → 下一次 LLM 循环时，LLM 就能看到 web-search 工具
```

---

## 工具参数的强类型保障总结

```
TypeSpec 定义（开发时）
  specs/tools/filesystem.tsp
    model ReadArgs { path: string; @minValue(1) offset?: int32; }

      ↓ tsp compile --emit @typespec/json-schema

生成 JSON Schema（共享）
  generated/schemas/tools/ReadArgs.json
    { "type":"object", "properties":{"path":{"type":"string"},...} }

      ↓ 在两处使用

运行时 A：发给 LLM（agent）
  toolRouter.getLLMTools() → [{ function:{ parameters: ReadArgs.json } }]
  LLM 按 JSON Schema 填写参数

运行时 B：验证入参（worker 内部）
  ReadArgsSchema = z.object({ path:z.string(), offset:z.number().int().min(1)... })
  const args = ReadArgsSchema.parse(JSON.parse(req.argsJson))
  // 验证失败 → ConnectError(CodeInvalidArgument) → 返回给 LLM 重试

关键保障：
  TypeSpec 是唯一来源
  JSON Schema 和 zod schema 对应同一个 TypeSpec 模型
  两者不会漂移（TypeSpec 改动 → 重新生成 → 更新 zod → 编译报错或重跑）
```

---

## 扩展工具：如何添加自定义工具

### 场景：添加 ripgrep 替代内置 grep

**1. 创建 ToolService 实现**

```typescript
// ripgrep-service/src/main.ts
import { createServer } from '@openzerg/common/tool-service-server'
import { z } from 'zod'

const server = createServer({
  tools: [{
    name: 'grep',
    description: 'Search file contents using ripgrep (faster, supports .gitignore)',
    inputSchemaJson: '{ "type":"object", "properties":{ "pattern":{"type":"string"}, ... } }',
    priority: 20,  // 高于内置 grep（priority=0），自动覆盖
    argsSchema: z.object({ pattern: z.string(), path: z.string().optional() }),
    async execute(args, context) {
      const { $ } = await import('bun')
      const result = await $`rg --json ${args.pattern} ${args.path ?? '.'}`.text()
      return { resultJson: JSON.stringify({ output: result }), success: true }
    }
  }]
})

server.listen(15350)
```

**2. 在 Role 配置中添加**

```json
{
  "roleId": "build",
  "mcpServers": [
    { "name": "ripgrep", "url": "http://localhost:15350", "priority": 20 }
  ]
}
```

**3. 效果**

agent 路由表中，`grep` 工具指向 ripgrep-service（priority=20 > 内置 priority=0）。LLM 调用 `grep` 时自动使用 ripgrep 实现。无需修改任何现有服务代码。
