# worker

Worker 服务。提供远程文件系统操作和命令执行能力。Worker 是无状态的 —— 所有智能逻辑在调用方中。

## ConnectRPC 接口

| 方法 | 功能 |
|------|------|
| `Exec` | 在工作区执行命令，返回 stdout/stderr/exitCode |
| `Spawn` | 启动后台任务，返回 jobId |
| `ReadFile` | 读取文件内容（bytes + mtimeMs） |
| `WriteFile` | 写入文件（携带 expectedMtimeMs 做冲突检测） |
| `Stat` | 获取文件元信息 |

## 关键设计

- **无状态**：Worker 不维护会话状态
- **WriteFile 冲突检测**：通过 `expectedMtimeMs` 实现 optimistic locking
- **mkdir -p**：WriteFile 自动创建父目录
- **Token 鉴权**：每个 Worker 有独立 secret

## 技术栈

| 属性 | 值 |
|------|-----|
| 运行时 | Bun |
| RPC | ConnectRPC v2 |
| 错误处理 | neverthrow Result monad |
| API 定义 | common-spec（TypeSpec → proto） |

## 环境变量

```bash
WORKER_PORT=15330
WORKER_SECRET=<secret>
WORKSPACE_ROOT=/data/workspace
REGISTRY_URL=http://localhost:15319
```

## 开发

```bash
bun install && bun run typecheck && bun run dev
```
