# channel

Channel 服务（消息总线）。提供 Chatroom 管理和消息传递的 ZCP 工具。

## 状态

**骨架包** —— 仅包含 `package.json` + `tsconfig.json`，无实现代码。

## 规划功能

| 工具 | 功能 |
|------|------|
| `chatroom-create` | 创建聊天室 |
| `chatroom-list` | 列出聊天室 |
| `chatroom-send` | 发送消息 |
| `chatroom-read` | 读取消息 |

## 技术栈（计划）

| 属性 | 值 |
|------|-----|
| 运行时 | Bun |
| RPC | ConnectRPC v2 |
| 数据库 | PostgreSQL（Kysely + postgres.js） |
| 错误处理 | neverthrow Result monad |
| ZCP SDK | @openzerg/zcp（IZcpTool + createZcpServer） |
| Schema 验证 | Zod v4 |

## 环境变量

```bash
CHANNEL_PORT=15318
DATABASE_URL=postgresql://openzerg:${DB_PASSWORD}@localhost:5433/openzerg
REGISTRY_URL=http://localhost:15319
```

## 开发

```bash
bun install && bun run typecheck && bun run dev
```
