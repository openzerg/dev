# common-spec

OpenZergUltra 共享代码包（`@openzerg/common`）。包含 proto 定义、代码生成、实体 schema 和客户端封装。

## 架构

```
TypeSpec 源码 (specs/*.tsp)
  → buf generate → generated/ts/gen/*_pb.ts     (Proto 消息类型 + Service 描述符)
  → 自定义 codegen → generated/ts/entities/*-schema.ts  (Zod 验证 + Kysely 类型)
  → 手写封装 → client/src/*.ts                   (ConnectRPC 客户端工厂 + ToolRouter + AppError 层级)
```

## 目录结构

```
common-spec/
├── specs/                        # TypeSpec API 定义
│   ├── registry.tsp              # RegistryService（Auth + Instance + Role + Session + Message + Worker）
│   ├── agent.tsp                 # AgentService（Chat + SSE + SwitchRole）
│   ├── ai_proxy.tsp              # AiProxyService（Proxy + Config + Logs）
│   ├── worker.tsp                # WorkerService（Exec + Spawn + ReadFile + WriteFile + Stat）
│   └── tools/tool-service.tsp    # ToolService（ListTools + ExecuteTool）
├── generated/ts/
│   ├── gen/                      # Proto 生成代码（*_pb.ts，v2 格式）
│   └── entities/                 # Zod schema + Kysely 类型
├── client/src/
│   ├── index.ts                  # 统一导出
│   ├── errors.ts                 # AppError 层级 + toAppError
│   ├── common.ts                 # Transport 工厂
│   ├── registry.ts               # RegistryClient
│   ├── agent.ts                  # AgentClient
│   ├── ai-proxy.ts               # AiProxyClient
│   ├── worker.ts                 # WorkerClient
│   └── tool-service.ts           # ToolRouter（listTools / executeTool / getSystemContext）
├── package.json
└── tsconfig.json
```

## 技术栈

| 属性 | 值 |
|------|-----|
| API 定义 | TypeSpec → proto → buf (protoc-gen-es v2) → TypeScript |
| Proto 生成 | `@bufbuild/protobuf` v2（Message 是 plain object + `$typeName`） |
| Schema 验证 | Zod v4（从 TypeSpec entity 自动生成） |
| 数据库类型 | Kysely `Database` 接口（从 Zod schema 推导） |
| RPC 客户端 | `@connectrpc/connect` v2（`createClient`） |
| 错误类型 | `AppError` 层级 + `toAppError`（neverthrow 兼容） |

## 导出

```typescript
import { AppError, DbError, NotFoundError, toAppError } from "@openzerg/common"
import { createRegistryClient, createAgentClient } from "@openzerg/common"
import type { LoginRequest } from "@openzerg/common/gen/registry/v1_pb.js"
import { RoleSchema, type Role } from "@openzerg/common/entities/role-schema.js"
import type { Database } from "@openzerg/common/entities/kysely-database.js"
```
