# Zerg Context Protocol (ZCP) SDK

`@openzerg/zcp` — 开发 ZCP 服务的通用 SDK。

## ZCP vs MCP

ZCP（Zerg Context Protocol）是 OpenZergUltra 的工具调用协议，替代 MCP（Model Context Protocol）。核心差异：

| 维度 | MCP | ZCP |
|------|-----|-----|
| 协议 | JSON-RPC over stdio/SSE | ConnectRPC (gRPC-Connect) over HTTP |
| 传输 | 双向长连接 | Unary request/response |
| 注册发现 | 无（手动配置 URL） | Registry 注册中心自动发现 |
| 路由 | 客户端直连 | sessionToken → Registry 解析 → 目标容器 |
| 执行环境 | 本地进程 | `podman exec` 在远程 Worker 中 |

## 核心组件

### PodmanClient

通过 Podman REST API（HTTP）在远程容器中执行命令。不直接挂载 Unix socket，而是通过 nginx 代理访问宿主机的 Podman TCP 端口。

```
ZCP Service → nginx:8080/podman/ → host:28888 → podman.sock
```

**关键方法**：
- `createExec(container, cmd, opts)` → exec ID
- `startExec(execId, opts)` → stdout/stderr
- `inspectExec(execId)` → { running, exitCode }
- `execCommand(container, command, opts)` → 高层封装（一步完成 create+start+collect）

### IZcpTool 接口

所有 ZCP 工具必须实现此接口：

```typescript
interface IZcpTool {
  name: string
  description: string
  inputSchemaJson: string    // JSON Schema
  outputSchemaJson: string
  group: string
  priority: number
  execute(args, ctx: ZcpContext): Promise<ZcpToolResult>
}
```

### ZcpContext

每次工具执行时的上下文，提供：
- `podman: PodmanClient` — 已初始化的 Podman 客户端
- `workerContainer: string` — 目标 Worker 容器名
- `workspaceRoot: string` — 容器内工作区根路径
- `sessionToken: string` — 当前 session 的 token

### ZcpServer

ConnectRPC `ToolService` 服务端基类：
- 注册 IZcpTool 实例
- `createRouter()` → 返回 ConnectRPC 路由函数
- 自动处理 `listTools` / `executeTool` RPC
- executeTool 内部流程：sessionToken → SessionResolver → workerId → 构造 ZcpContext → 执行工具

### SessionResolver

将 `sessionToken` 解析为 `workerContainer` + `workspaceRoot`：
- 调用 `Registry.ResolveSession(sessionToken)`
- 缓存结果（TTL 5 分钟）

## 目录结构

```
src/
├── index.ts                 # 统一导出
├── podman/
│   ├── client.ts            # PodmanClient — Podman REST API 封装
│   └── types.ts             # Podman API 类型定义
├── zcp/
│   ├── tool.ts              # IZcpTool / ZcpContext / ZcpToolResult
│   ├── registry.ts          # ZcpToolRegistry
│   ├── server.ts            # ZcpServer — ConnectRPC ToolService 服务端
│   └── session-resolver.ts  # SessionResolver — sessionToken → workerId
└── util/
    ├── path.ts              # 路径安全工具
    └── json.ts              # JSON 解析工具
```

## 依赖

| 包 | 用途 |
|---|---|
| `@openzerg/common` | ConnectRPC ToolService proto 定义 + RegistryClient |
| `@connectrpc/connect` | ConnectRPC 服务端框架 |
| `neverthrow` | Result monad 错误处理 |

## 使用方式

ZCP SDK 被两个 ZCP 服务引用：
- `zcp-fs` — 文件系统工具（read/write/edit/glob/grep/ls）
- `zcp-job` — 进程执行工具（job-run/job-list/job-kill/job-output）

```typescript
import { ZcpServer, IZcpTool, ZcpContext, ZcpToolResult } from "@openzerg/zcp"

const server = new ZcpServer({ podmanBaseUrl, registryUrl, adminToken })
server.registerTool(myTool)
const router = server.createRouter()
// 传给 connectNodeAdapter({ routes: router })
```
