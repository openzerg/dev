# zcp-fs

文件系统 ZCP 服务。通过 `podman exec` 在 Worker 中执行文件操作。

## 提供的工具

| 工具 | 功能 | Podman exec 命令 |
|------|------|-----------------|
| `read` | 读取文件/目录内容 | `cat <path>` / `ls -1A <path>` |
| `write` | 写入文件（含 diff） | `mkdir -p + cat > <path>` (stdin pipe) |
| `edit` | 精确字符串替换 | 读取 → 内存替换 → 写回 |
| `multi-edit` | 批量编辑 | 同上 |
| `apply-patch` | 应用 unified diff | 同上 |
| `glob` | 按模式搜索文件 | `rg --files --glob <pattern>` |
| `grep` | 正则搜索文件内容 | `rg -nH <pattern>` |
| `ls` | 目录树 | `rg --files` → 内存构建树 |

## 架构

```
Agent (session runner)
  → Registry.ListInstances(type="zcp-fs")
  → 获取 zcp-fs URL
  → ToolServiceClient(url).executeTool("read", {path: "src/main.ts"}, sessionToken)

zcp-fs 收到请求:
  → SessionResolver: sessionToken → workerContainer = "worker-ws-a3f8"
  → PodmanClient.execCommand("worker-ws-a3f8", "cat /data/workspace/src/main.ts")
  → 返回文件内容
```

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
