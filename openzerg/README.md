# OpenZergUltra

OpenZergUltra 是下一代多智能体协作平台，基于 **Session 为核心管理单元**的全新架构设计。

相比 OpenZergNeo，OpenZergUltra 引入了：

- **Session 作为第一公民**：每个 Session 独立选择 Workspace（执行环境）和 Role（能力配置），而非绑定在 Agent 容器上
- **完全插件化的工具系统**：agent 零内置工具，所有工具通过 ConnectRPC ToolService 协议从外部服务动态获取
- **TypeSpec 统一 API 定义**：单一 `.tsp` 源文件同时生成 proto（ConnectRPC 接口）和 JSON Schema（工具参数），彻底消除类型漂移
- **全局 PostgreSQL**：取代各服务独立 SQLite，统一持久化，支持 agent 水平扩展

---

## 快速开始

```bash
# 首次部署
bash cli/openzerg-cli.sh setup        # 生成密钥
bash scripts/build-all.sh             # 构建镜像
bash cli/openzerg-cli.sh start        # 启动服务
bash cli/openzerg-cli.sh init         # 初始化 Forgejo + Garage

# 创建工作区和会话
oz worker create my-project
oz session create --role plan --worker my-project

# 访问 WebUI：http://{HOST_IP}:8080
```

---

## 核心架构

```
用户 / WebUI
    │
    ▼
registry（鉴权 + Session 路由 + Workspace 管理）
    │
    ├──► agent × N（无状态，水平扩展）
    │         └── 每个 Session：
    │               LLM 推理 + ConnectRPC ToolService 调用
    │
    ├──► worker（文件系统 + 进程执行 ToolService）
    ├──► zcp-skill（Role/Skill/Memory/Todo + ToolService）
    ├──► channel（消息总线 + Chatroom ToolService）
    └──► ai-proxy（LLM 代理）
    
    所有服务共享 PostgreSQL（via PgBouncer）
    二进制文件存 Garage S3
```

---

## 服务一览

| 服务 | 语言 | 端口 | 职责 |
|------|------|------|------|
| registry | TypeScript/Bun | 15319 | 注册中心、鉴权、Session 路由 |
| agent | TypeScript/Bun | 15330+ | Session 调度、LLM 推理（零内置工具）|
| worker | TypeScript/Bun | 15340+ | 文件系统 + 执行 ToolService |
| zcp-skill | Go | 15320 | Role/Skill/Memory + ToolService |
| channel | Go | 15318 | 消息总线 + Chatroom ToolService |
| ai-proxy | TypeScript/Bun | 15316 | LLM 代理（Provider 模板 + 自动 API Key） |
| overmind-webui | TypeScript/SolidJS | 8080 | 管理控制台 |
| PostgreSQL | — | 5433（PgBouncer）| 全局持久化 |
| Garage | Rust | 15322 | S3 文件存储 |

---

## 文档

| 文档 | 说明 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | **系统架构总览**（从这里开始阅读）|
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | 开发工作流、构建、测试 |
| [docs/services.md](docs/services.md) | 各服务详细规范 |
| [docs/data-model.md](docs/data-model.md) | PostgreSQL Schema 设计 |
| [docs/api-design.md](docs/api-design.md) | ConnectRPC + TypeSpec 规范 |
| [docs/session-lifecycle.md](docs/session-lifecycle.md) | Session 状态机 |
| [docs/mcp-tools.md](docs/mcp-tools.md) | 工具系统详细设计 |

---

## 与 OpenZergNeo 的主要差异

| 维度 | OpenZergNeo | OpenZergUltra |
|------|------------|---------------|
| 管理单元 | Agent 容器 | **Session** |
| 工具内置 | mutalisk 内置 23 个工具 | agent **零内置工具** |
| 工具协议 | 私有 ExternalTool HTTP | **ConnectRPC ToolService（统一协议）** |
| Role 粒度 | Agent 级别（固定） | **Session 级别（可实时切换）** |
| Workspace | Agent 容器内目录 | **独立持久化 pod，跨 Session 共享** |
| 数据库 | 各服务独立 SQLite | **全局 PostgreSQL + PgBouncer** |
| API 定义 | 手写 proto（两套手动同步）| **TypeSpec 单一来源** |
| 水平扩展 | mutalisk 容器 × N | **agent 无状态 × N** |
