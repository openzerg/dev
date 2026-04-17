# zcp-memory

Memory + Todo ZCP 服务。提供 agent 持久化内存和会话任务管理，基于 PostgreSQL。

## 提供的工具

| 工具 | 功能 |
|------|------|
| `memory-save` | 保存内存条目（bucket + key → value） |
| `memory-read` | 读取内存条目 |
| `memory-list` | 列出 bucket 内所有内存条目 |
| `todo-write` | 替换会话任务列表（delete-all + insert-all 事务） |
| `todo-read` | 读取会话任务列表 |

## 数据模型

### memory_entries

| 列 | 类型 | 说明 |
|------|------|------|
| id | text PK | UUID |
| bucket_name | text | 分桶名（来自 serverConfig.bucketName 或 sessionId） |
| key | text | 键名 |
| value | text | 值内容 |
| created_at | bigint | 创建时间 |
| updated_at | bigint | 更新时间 |

唯一索引：`(bucket_name, key)`

### todo_entries

| 列 | 类型 | 说明 |
|------|------|------|
| session_id | text | 会话 ID |
| position | integer | 排序位置 |
| content | text | 任务内容 |
| status | text | 状态（pending/in_progress/completed/cancelled） |
| priority | text | 优先级（high/medium/low） |
| created_at | bigint | 创建时间 |
| updated_at | bigint | 更新时间 |

复合主键：`(session_id, position)`

## 技术栈

| 属性 | 值 |
|------|-----|
| 运行时 | Bun |
| RPC | ConnectRPC v2 |
| 数据库 | PostgreSQL（Kysely + postgres.js） |
| ZCP SDK | @openzerg/zcp（IZcpTool + createZcpServer） |
| 错误处理 | neverthrow Result monad |
| Schema 验证 | Zod v4 |
| API 定义 | common-spec（TypeSpec → proto） |

## 环境变量

```bash
ZCP_MEMORY_PORT=15342
DATABASE_URL=postgresql://openzerg:${DB_PASSWORD}@localhost:5433/openzerg
REGISTRY_URL=http://localhost:15319
ADMIN_TOKEN=<管理员 Token>
```

## 开发

```bash
bun install && bun run typecheck && bun run dev
```
