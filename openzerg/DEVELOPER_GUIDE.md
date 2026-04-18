# OpenZergUltra 开发者指南

## 目录

1. [开发环境准备](#1-开发环境准备)
2. [仓库结构](#2-仓库结构)
3. [common-spec 工作流（核心）](#3-common-spec-工作流核心)
4. [各服务本地开发](#4-各服务本地开发)
5. [容器构建规范](#5-容器构建规范)
6. [数据库管理](#6-数据库管理)
7. [服务启动与运维](#7-服务启动与运维)
8. [E2E 测试](#8-e2e-测试)

---

## 1. 开发环境准备

### 必备工具

```bash
# 容器运行时（必须）
podman >= 4.0
podman-compose >= 1.0

# Go 服务开发（registry、zcp-skill、channel）
go >= 1.25

# TypeScript 服务开发（agent、worker、ai-proxy、overmind-webui）
bun >= 1.0

# API 定义与代码生成（common-spec 工作流）
typespec >= 1.11.0    # npm install -g @typespec/compiler
buf >= 1.0            # brew install bufbuild/buf/buf 或 nix

# 数据库工具
migrate               # go install github.com/golang-migrate/migrate/v4/...
psql                  # PostgreSQL 客户端（调试用）

# Nix（用于 Go 服务 dev shell，推荐）
nix >= 2.18
```

### openzerg-cli 快速命令

```bash
alias oz="bash /home/admin/OpenZergUltra/openzerg/cli/openzerg-cli.sh"

oz setup              # 首次初始化：生成所有密钥和配置
oz start              # 启动所有服务
oz stop               # 停止所有服务
oz status             # 服务健康检查

oz worker create proj-abc   # 创建 Workspace
oz worker list              # 列出 Workspace

oz session create --role plan --worker proj-abc
oz session list
oz session chat <id> "帮我分析代码"

oz db migrate         # 运行 PostgreSQL migration
oz db status          # 查看 migration 状态
```

---

## 2. 仓库结构

```
OpenZergUltra/
├── common-spec/        API 定义唯一来源（TypeSpec + 生成代码 + client wrapper）
├── registry/            服务注册中心 + 鉴权 + Session 路由 + Workspace 管理
├── agent/               Session 调度器 + LLM 推理（零内置工具）
├── worker/              文件系统 + 执行 ToolService（MCP 服务器）
├── zcp-skill/           Role/Skill/Memory/Todo 管理 + ToolService
├── channel/             消息总线 + Chatroom ToolService
├── ai-proxy/            LLM 代理（OpenAI 兼容）
├── overmind-webui/     管理控制台（SolidJS）
└── openzerg/           运维配置（本仓库）
    ├── ARCHITECTURE.md     系统架构（主文档）
    ├── DEVELOPER_GUIDE.md  开发者指南（本文）
    ├── docs/
    │   ├── services.md         服务详细规范
    │   ├── data-model.md       PostgreSQL Schema 设计
    │   ├── api-design.md       ConnectRPC + TypeSpec 规范
    │   ├── session-lifecycle.md Session 状态机
    │   └── mcp-tools.md        工具系统详细设计
    ├── compose/
    │   ├── compose.yaml        生产环境
    │   └── compose.dev.yaml    开发环境（含 PostgreSQL 暴露端口）
    ├── cli/
    │   ├── openzerg-cli.sh     主入口
    │   └── commands/           子命令
    ├── e2e/                    E2E 测试套件
    ├── nginx/                  nginx 配置
    ├── scripts/                构建/部署脚本
    └── templates/              配置模板
```

---

## 3. common-spec 工作流（核心）

`common-spec` 是所有 API 定义的**唯一真相来源**。任何跨服务的类型变更都从这里开始。

### 完整更新流程

```bash
cd /home/admin/OpenZergUltra/common-spec

# 步骤 1：修改 TypeSpec 文件
vim specs/worker.tsp          # 服务接口变更
vim specs/tools/filesystem.tsp   # 工具参数变更

# 步骤 2：生成所有产物（一键）
make generate
# 等价于：
#   tsp compile specs/             → generated/proto/ + generated/schemas/
#   buf generate generated/proto/  → generated/node/ + generated/go/

# 步骤 3：如果有新 RPC，更新 client wrapper
vim client/node/worker.ts     # TypeScript client
vim client/go/worker.go       # Go client

# 步骤 4：验证
cd client/node && bun run typecheck
cd client/go  && go build ./...

# 步骤 5：提交
git add -A
git commit -m "feat: add StreamTool RPC to WorkerService"
git push origin main

# 步骤 6：各服务更新依赖
# TypeScript 服务：
cd /home/admin/OpenZergUltra/agent
bun add github:openzerg/common-spec#main

# Go 服务：
cd /home/admin/OpenZergUltra/registry
GOPROXY=direct go get github.com/openzerg/common-spec@main
go mod tidy
```

### 各服务依赖 common-spec 的方式

| 服务语言 | 引用方式 |
|---------|---------|
| TypeScript（agent、worker、ai-proxy） | `"@openzerg/common": "github:openzerg/common-spec#main"` |
| TypeScript（overmind-webui） | `"@openzerg/common": "file:../common-spec"` （本地，实时）|
| Go（registry、zcp-skill、channel） | `go get github.com/openzerg/common-spec@main` |

> **overmind-webui 使用 `file:../common-spec`**，修改 TypeSpec 后无需 push 即可实时看到效果。

---

## 4. 各服务本地开发

### 前置：启动基础设施

开发时需要 PostgreSQL 和 PgBouncer 在本地运行：

```bash
cd /home/admin/OpenZergUltra/openzerg

# 仅启动基础设施服务（不启动业务服务）
podman-compose -f compose/compose.dev.yaml up -d postgres pgbouncer garage forgejo

# 运行 migration
oz db migrate
```

### registry（Go）

```bash
cd /home/admin/OpenZergUltra/registry
nix develop    # 或手动确保 go >= 1.25

# 启动
DATABASE_URL=postgresql://openzerg:dev@localhost:5433/openzerg \
REGISTRY_PORT=15319 \
ADMIN_TOKEN=dev-admin-token \
JWT_SECRET=dev-jwt-secret \
HOST_IP=127.0.0.1 \
PODMAN_SOCKET=/run/user/1000/podman/podman.sock \
go run ./cmd/registry/
```

### agent（TypeScript/Bun）

```bash
cd /home/admin/OpenZergUltra/agent
bun install

DATABASE_URL=postgresql://openzerg:dev@localhost:5433/openzerg \
REGISTRY_URL=http://localhost:15319 \
ADMIN_TOKEN=dev-admin-token \
JWT_SECRET=dev-jwt-secret \
HOST_IP=127.0.0.1 \
INSTANCE_NAME=runner-dev-01 \
SESSION_RUNNER_PORT=15330 \
bun run src/main.ts
```

### worker（TypeScript/Bun）

```bash
cd /home/admin/OpenZergUltra/worker
bun install

mkdir -p /tmp/worker-dev

WORKSPACE_PORT=15340 \
FILESYSTEM_MCP_PORT=15341 \
EXECUTION_MCP_PORT=15342 \
WORKSPACE_ROOT=/tmp/worker-dev \
REGISTRY_URL=http://localhost:15319 \
ADMIN_TOKEN=dev-admin-token \
INSTANCE_NAME=worker-dev-01 \
HOST_IP=127.0.0.1 \
bun run src/main.ts
```

### zcp-skill（Go）

```bash
cd /home/admin/OpenZergUltra/zcp-skill
nix develop

DATABASE_URL=postgresql://openzerg:dev@localhost:5433/openzerg \
ROLE_LAYER_PORT=15320 \
REGISTRY_URL=http://localhost:15319 \
ADMIN_TOKEN=dev-admin-token \
JWT_SECRET=dev-jwt-secret \
go run ./cmd/zcp-skill/
```

### overmind-webui（TypeScript/SolidJS）

```bash
cd /home/admin/OpenZergUltra/overmind-webui
npm install    # 自动使用 file:../common-spec（本地实时引用）

bun run dev    # http://localhost:3000
# 连接：http://127.0.0.1:8080（或直接 15319）
# API Key：dev-admin-token
```

---

## 5. 容器构建规范

### 构建方式

所有 Go 服务使用 **Nix 编译 + debian:trixie-slim 运行时**（nixos/nix build stage）。
TypeScript 服务使用 **Nix/Bun 编译 + debian:trixie-slim 运行时**。

```bash
# 构建单个服务
cd /home/admin/OpenZergUltra/registry
podman build -t localhost/uz-registry:latest .

# 构建所有服务
bash /home/admin/OpenZergUltra/openzerg/scripts/build-all.sh

# 快速热更新（不重建镜像）
bash /home/admin/OpenZergUltra/openzerg/scripts/rebuild-go.sh registry
bash /home/admin/OpenZergUltra/openzerg/scripts/rebuild-ts.sh agent
```

### overmind-webui 特殊说明

```bash
# 必须先构建 dist/，再 podman build
cd /home/admin/OpenZergUltra/overmind-webui
bun run build           # 生成 dist/
podman build -t localhost/uz-overmind-webui:latest .
```

---

## 6. 数据库管理

### Migration 文件位置

所有 migration 统一在 `common-spec/migrations/`：

```
common-spec/migrations/
├── 000001_init_instances.up.sql
├── 000001_init_instances.down.sql
├── 000002_init_sessions.up.sql
├── ...
```

### 运行 Migration

```bash
# 通过 openzerg-cli（推荐）
oz db migrate         # 执行所有 pending migrations
oz db rollback        # 回滚最后一个 migration
oz db status          # 查看当前 migration 状态

# 直接使用 migrate 工具
migrate \
  -database "postgresql://openzerg:${DB_PASSWORD}@localhost:5433/openzerg?sslmode=disable" \
  -path /home/admin/OpenZergUltra/common-spec/migrations \
  up
```

### 添加新 Migration

```bash
# 创建新的 migration 文件
migrate create -ext sql -dir common-spec/migrations -seq add_worker_tags
# 生成：000010_add_worker_tags.up.sql 和 .down.sql

# 编写 SQL
vim common-spec/migrations/000010_add_worker_tags.up.sql
```

---

## 7. 服务启动与运维

### 首次部署

```bash
cd /home/admin/OpenZergUltra/openzerg

# 1. 生成所有密钥和配置文件（~/.local/share/.env）
oz setup

# 2. 构建所有镜像
bash scripts/build-all.sh

# 3. 启动基础设施
podman-compose -f compose/compose.yaml up -d postgres pgbouncer garage forgejo nginx

# 4. 运行 migration
oz db migrate

# 5. 初始化 Forgejo
oz init-forgejo

# 6. 初始化 Garage S3（聊天室文件上传）
oz init-garage

# 7. 启动业务服务
podman-compose -f compose/compose.yaml up -d registry zcp-skill channel ai-proxy agent overmind-webui

# 8. 创建第一个 Workspace
oz worker create my-project

# 9. 创建 Session
oz session create --role plan --worker my-project
```

### 日常操作

```bash
oz start               # 启动所有服务
oz stop                # 停止所有服务
oz restart             # 重启所有服务
oz status              # 健康检查

oz logs registry -f    # 实时日志
oz logs agent-1 -f

oz worker create <name>          # 创建 Workspace
oz worker list                   # 列出 Workspace
oz worker delete <id>            # 删除 Workspace

oz session create --role <roleId> [--worker <workerId>]
oz session list
oz session delete <id>

oz role list                        # 列出 Role
oz role create --slug plan --name "Planning Agent"
```

### 环境变量（~/.local/share/.env）

```bash
# 由 oz setup 生成
ADMIN_TOKEN=<管理员 API Key>
JWT_SECRET=<JWT 签名密钥，256-bit>
DB_PASSWORD=<PostgreSQL 密码>
FORGEJO_ADMIN_PASS=<Forgejo 密码>
FORGEJO_SECRET_KEY=<Forgejo 密钥>
GARAGE_ADMIN_TOKEN=<Garage 管理 Token>
GARAGE_RPC_SECRET=<Garage 集群密钥>
GARAGE_ACCESS_KEY=<S3 访问密钥>（init-garage 后生成）
GARAGE_SECRET_KEY=<S3 密钥>（init-garage 后生成）
HOST_IP=172.16.11.92
```

---

## 8. E2E 测试

> 完整 E2E 测试套件位于 `openzerg/e2e/`，测试环境使用独立端口，不影响生产。

### 快速运行

```bash
cd /home/admin/OpenZergUltra/openzerg/e2e
bun install

# 一键运行：启动环境 → 测试 → 清理
bash test-env.sh run

# 运行指定测试
bash test-env.sh run tests/registry.test.ts
bash test-env.sh run tests/session.test.ts
```

### 分步运行

```bash
bash test-env.sh start    # 启动测试环境（独立端口）
bash test-env.sh test     # 运行测试
bash test-env.sh stop     # 清理
```

### 测试文件

| 文件 | 测试内容 |
|------|---------|
| `tests/registry.test.ts` | 服务注册、鉴权、Session 路由、Workspace 管理 |
| `tests/session.test.ts` | Session 创建/恢复/删除、消息历史 |
| `tests/tools.test.ts` | ToolService 协议（ListTools、ExecuteTool、StreamTool） |
| `tests/zcp-skill.test.ts` | Role/Skill/Memory/Todo CRUD |
| `tests/channel.test.ts` | 聊天室消息、@mention 触发 |
| `tests/ai-proxy.test.ts` | LLM 代理配置和调用 |
| `tests/e2e-session.test.ts` | 完整的 Session 推理流程（需真实 LLM API Key） |

### 环境变量（可选）

```bash
# LLM 相关（用于 e2e-session 测试）
export LLM_API_KEY=sk-xxx
export LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
export LLM_MODEL=qwen3.5-plus
```
