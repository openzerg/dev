# zcp-job

进程执行 ZCP 服务。通过 `podman exec` 在 Worker 中运行和管理 shell 命令。

## 提供的工具

| 工具 | 功能 | 说明 |
|------|------|------|
| `job-run` | 执行 shell 命令 | `podman exec -d worker-xxx bash -c "cmd > stdout 2> stderr; echo $? > exitcode"` |
| `job-list` | 列出所有进程 | 查询内存中的 job 列表 + 检查状态 |
| `job-kill` | 终止进程 | `podman exec worker-xxx kill <pid>` |
| `job-output` | 读取进程输出 | `podman exec worker-xxx cat /tmp/zcp-jobs/<id>/stdout` |

## 进程管理模式

```
job-run(command, cwd):
  1. jobId = randomId()
  2. podman exec worker-xxx mkdir -p /tmp/zcp-jobs/<jobId>
  3. podman exec -d worker-xxx bash -c "(command) > /tmp/zcp-jobs/<jobId>/stdout 2> /tmp/zcp-jobs/<jobId>/stderr; echo $? > /tmp/zcp-jobs/<jobId>/exitcode"
  4. 记录 { jobId, container } 到内存
  5. 返回 { jobId }

job-output(jobId):
  1. podman exec worker-xxx cat /tmp/zcp-jobs/<jobId>/stdout
  2. podman exec worker-xxx cat /tmp/zcp-jobs/<jobId>/stderr
  3. podman exec worker-xxx cat /tmp/zcp-jobs/<jobId>/exitcode
  4. 返回 { stdout, stderr, exitCode, done: exitcode存在 }

job-kill(jobId):
  1. 查找 { container, pid }
  2. podman exec worker-xxx kill <pid> SIGTERM

job-list():
  1. 遍历内存中的 job 列表
  2. 对每个 job 检查 exitcode 文件是否已写入
```

## ProcessManager

管理跨多个 Worker 的进程状态。每个 job 记录：
- `jobId` — 唯一标识
- `container` — 目标 Worker 容器名
- `command` — 原始命令
- `startedAt` — 启动时间

进程状态存储在容器内的 `/tmp/zcp-jobs/<jobId>/` 目录中，不在 ZCP 服务侧持久化。

## 端口

25000+，启动时随机绑定，通过 Registry 注册发现。

## 环境变量

```bash
PODMAN_URL=http://nginx:8080/podman/     # Podman REST API（通过 nginx 代理）
REGISTRY_URL=http://registry:25XXX      # Registry 注册中心
ADMIN_TOKEN=<管理员 Token>                  # Registry 鉴权
ZCP_PORT=0                                 # 0 = 随机端口
```

## 技术栈

| 属性 | 值 |
|------|-----|
| 运行时 | Bun |
| RPC | ConnectRPC v2 |
| ZCP SDK | @openzerg/zcp（IZcpTool + createZcpServer） |
| 错误处理 | neverthrow Result monad |
| Schema 验证 | Zod v4 |
| API 定义 | common-spec（TypeSpec → proto） |

## 开发

```bash
bun install && bun run typecheck && bun run dev
```
