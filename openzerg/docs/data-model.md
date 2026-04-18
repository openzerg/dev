# 数据模型设计

OpenZergUltra 使用 **PostgreSQL** 作为全局唯一持久化存储，所有服务通过 **PgBouncer** 连接池接入。Schema 迁移统一在 `common-spec` 仓库管理。

---

## 总体设计原则

- 所有主键使用 **UUID v4**（TEXT 类型，`gen_random_uuid()`）
- 所有时间字段使用 **TIMESTAMPTZ**（带时区）
- **Append-Only 设计**：`registry_messages` 表只插入，不更新不删除（Compacting 除外）
- **软删除**：重要实体用 `deleted_at` 而非物理删除
- 每个服务只读写**自己负责的表**，跨域数据通过 ConnectRPC

---

## 完整 Schema

### 基础设施层（registry 负责）

```sql
-- 服务实例注册表
CREATE TABLE registry_instances (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  instance_type   TEXT NOT NULL,        -- 'registry' | 'worker' | 'agent' | 'channel' | 'ai-proxy' | 'zcp-skill'
  lifecycle       TEXT NOT NULL DEFAULT 'starting',
                                        -- 'starting' | 'running' | 'degraded' | 'stopped'
  health          TEXT NOT NULL DEFAULT 'unknown',
                                        -- 'healthy' | 'unhealthy' | 'unknown'
  ip              TEXT NOT NULL,
  port            INTEGER NOT NULL,
  public_url      TEXT,
  labels          JSONB NOT NULL DEFAULT '{}',
  last_heartbeat  TIMESTAMPTZ,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registry_instances_type ON registry_instances(instance_type);
CREATE INDEX idx_registry_instances_lifecycle ON registry_instances(lifecycle);

-- 用户 API Key（bcrypt hash）
CREATE TABLE api_keys (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,        -- 逻辑用户 ID
  key_hash        TEXT NOT NULL UNIQUE, -- bcrypt hash of the raw key
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ          -- 非空表示已撤销
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
```

---

### Worker 层（registry 管理元数据）

```sql
-- Worker 实例
CREATE TABLE registry_workers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  container_name  TEXT,                 -- Podman 容器名
  data_volume     TEXT,                 -- 挂载的 named volume
  filesystem_url  TEXT,                 -- filesystem ToolService endpoint
  execution_url   TEXT,                 -- execution ToolService endpoint
  lifecycle       TEXT NOT NULL DEFAULT 'starting',
                                        -- 'starting' | 'running' | 'stopped' | 'deleted'
  disk_usage_mb   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at      TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_registry_workers_lifecycle ON registry_workers(lifecycle);
```

---

### Session 层（registry 管元数据，agent 读写消息）

```sql
-- Session 元数据
CREATE TABLE registry_sessions (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id             TEXT REFERENCES registry_roles(id),
  worker_id           TEXT REFERENCES registry_workers(id),
  session_type        TEXT NOT NULL DEFAULT 'normal',
                                        -- 'normal' | 'chatroom' | 'task' | 'sub-task'
  state               TEXT NOT NULL DEFAULT 'idle',
                                        -- 'idle' | 'running' | 'compacting' | 'suspended'
  worker_binding      TEXT NOT NULL DEFAULT 'active',
                                        -- 'active' | 'suspended' | 'released'
  runner_instance_id  TEXT REFERENCES registry_instances(id),
                                        -- 当前处理该 session 的 runner（可为空）
  external_id         TEXT,             -- chatroom session 的聊天室 ID
  title               TEXT,             -- 用户可见的会话标题（自动或手动设置）
  input_tokens        INTEGER NOT NULL DEFAULT 0,
  output_tokens       INTEGER NOT NULL DEFAULT 0,
  compact_threshold   INTEGER NOT NULL DEFAULT 100000,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at        TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_registry_sessions_role ON registry_sessions(role_id);
CREATE INDEX idx_registry_sessions_worker ON registry_sessions(worker_id);
CREATE INDEX idx_registry_sessions_runner ON registry_sessions(runner_instance_id);
CREATE INDEX idx_registry_sessions_external ON registry_sessions(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_registry_sessions_state ON registry_sessions(state) WHERE deleted_at IS NULL;

-- Session 消息历史（Append-Only）
CREATE TABLE registry_messages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL REFERENCES registry_sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,        -- 'system' | 'user' | 'assistant' | 'tool'
  content         TEXT,                 -- 文本内容（assistant/user/tool 的输出）
  tool_calls      JSONB,               -- role='assistant' 时：[{ id, name, argsJson }]
  tool_name       TEXT,                 -- role='tool' 时：工具名
  tool_call_id    TEXT,                 -- role='tool' 时：关联的 tool_call id
  tool_success    BOOLEAN,             -- role='tool' 时：是否成功
  thinking        TEXT,                 -- LLM 的 thinking 内容（如有）
  input_tokens    INTEGER,             -- 本次 LLM 调用消耗的 input tokens
  output_tokens   INTEGER,             -- 本次 LLM 调用消耗的 output tokens
  seq             BIGSERIAL NOT NULL,  -- 单调递增序号，用于排序和分页
  is_compacted    BOOLEAN NOT NULL DEFAULT FALSE, -- 是否已被压缩为摘要
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT registry_messages_session_seq UNIQUE (session_id, seq)
);

-- 高效查询：按 session + 时间顺序
CREATE INDEX idx_registry_messages_session_seq ON registry_messages(session_id, seq);
-- 分页查询优化
CREATE INDEX idx_registry_messages_session_created ON registry_messages(session_id, created_at);
```

---

### 能力层（zcp-skill 负责）

```sql
-- Role 定义
CREATE TABLE registry_roles (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE, -- URL 友好标识符，如 'plan', 'build', 'chat'
  name            TEXT NOT NULL,
  description     TEXT,
  system_prompt   TEXT,                 -- 注入 LLM 的系统提示词
  compact_prompt  TEXT,                 -- 历史压缩时使用的提示词
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Role 关联的 MCP（ToolService）Server 配置
CREATE TABLE role_mcp_servers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT NOT NULL REFERENCES registry_roles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,        -- 显示名称
  url             TEXT NOT NULL,        -- ToolService ConnectRPC endpoint URL
  priority        INTEGER NOT NULL DEFAULT 0,
                                        -- 优先级：同名工具取 priority 最高的
  env             JSONB NOT NULL DEFAULT '{}',
                                        -- 传递给 ToolService 的额外上下文（如 API key）
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  UNIQUE(role_id, name)
);

CREATE INDEX idx_role_mcp_servers_role ON role_mcp_servers(role_id);

-- Skill 文档
CREATE TABLE skills (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  content         TEXT NOT NULL,        -- Markdown 内容
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Role 关联的 Skill
CREATE TABLE role_skills (
  role_id         TEXT NOT NULL REFERENCES registry_roles(id) ON DELETE CASCADE,
  skill_id        TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (role_id, skill_id)
);

-- Agent 持久化记忆（按 agent_name 隔离）
CREATE TABLE memory (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name      TEXT NOT NULL,
  filename        TEXT NOT NULL,        -- 如 'notes.md', 'context.txt'
  content         TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(agent_name, filename)
);

CREATE INDEX idx_memory_agent ON memory(agent_name);

-- Session 任务列表（按 session_id 隔离）
CREATE TABLE todos (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL REFERENCES registry_sessions(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
                                        -- 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority        TEXT NOT NULL DEFAULT 'medium',
                                        -- 'high' | 'medium' | 'low'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_todos_session ON todos(session_id);
CREATE INDEX idx_todos_status ON todos(session_id, status);
```

---

### 消息系统（channel 负责）

```sql
-- 聊天室
CREATE TABLE chatrooms (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  created_by      TEXT NOT NULL,        -- user_id 或 agent_name
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- 聊天室成员
CREATE TABLE chatroom_members (
  chatroom_id     TEXT NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
  member_id       TEXT NOT NULL,        -- user_id 或 instance.name
  member_type     TEXT NOT NULL,        -- 'user' | 'instance'
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at         TIMESTAMPTZ,
  PRIMARY KEY (chatroom_id, member_id)
);

-- 聊天室消息（文本部分；附件存 Garage S3，仅保存 URL）
CREATE TABLE chatroom_messages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  chatroom_id     TEXT NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL,        -- user_id 或 instance.name
  sender_type     TEXT NOT NULL,        -- 'user' | 'instance'
  content         TEXT,                 -- 文本内容
  attachments     JSONB NOT NULL DEFAULT '[]',
                                        -- [{ type, url, name, size, mime_type }]
  mentions        JSONB NOT NULL DEFAULT '[]',
                                        -- [{ memberId, memberType }]
  seq             BIGSERIAL NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chatroom_messages_room_seq ON chatroom_messages(chatroom_id, seq);
```

---

### LLM 代理层（ai-proxy 负责）

```sql
-- 上游 LLM 提供商模型配置（存储用户自己的 API Key 和连接信息）
CREATE TABLE ai_proxy_provider_model_configs (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id             TEXT NOT NULL,        -- 提供商 ID（来自 models.dev，如 "openai"）
  provider_name           TEXT NOT NULL,        -- 提供商显示名（如 "OpenAI"）
  model_id                TEXT NOT NULL,        -- 模型 ID（如 "gpt-4o"）
  model_name              TEXT NOT NULL,        -- 模型显示名（如 "GPT-4o"）
  upstream                TEXT NOT NULL,        -- 上游 API 基础 URL
  api_key                 TEXT NOT NULL,        -- 用户自己的上游 API Key
  support_streaming       BOOLEAN NOT NULL DEFAULT TRUE,
  support_tools           BOOLEAN NOT NULL DEFAULT FALSE,
  support_vision          BOOLEAN NOT NULL DEFAULT FALSE,
  support_reasoning       BOOLEAN NOT NULL DEFAULT FALSE,
  default_max_tokens      INTEGER NOT NULL DEFAULT 4096,
  context_length          INTEGER NOT NULL DEFAULT 0,
  auto_compact_length     INTEGER NOT NULL DEFAULT 0,
  enabled                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              BIGINT NOT NULL,      -- Unix 秒
  updated_at              BIGINT NOT NULL       -- Unix 秒
);

CREATE INDEX idx_ap_pmc_provider_id ON ai_proxy_provider_model_configs(provider_id);
CREATE INDEX idx_ap_pmc_enabled ON ai_proxy_provider_model_configs(enabled);

-- 对外代理端点（客户端通过此表的 apiKey 访问 LLM）
CREATE TABLE ai_proxy_proxies (
  id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  source_model              TEXT NOT NULL UNIQUE, -- 客户端使用的模型别名（如 "my-gpt-4o"）
  provider_model_config_id  TEXT NOT NULL REFERENCES ai_proxy_provider_model_configs(id),
  api_key                   TEXT NOT NULL,        -- 自动生成的 cpk_ 前缀 API Key
  enabled                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                BIGINT NOT NULL,      -- Unix 秒
  updated_at                BIGINT NOT NULL       -- Unix 秒
);

CREATE INDEX idx_ai_proxy_proxies_enabled ON ai_proxy_proxies(enabled);

-- LLM 调用日志（Append-only）
CREATE TABLE ai_proxy_logs (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_id                TEXT REFERENCES ai_proxy_proxies(id),
  source_model            TEXT NOT NULL,        -- 客户端请求的模型别名
  target_model            TEXT NOT NULL,        -- 实际转发到上游的模型 ID
  upstream                TEXT NOT NULL,        -- 上游 URL
  input_tokens            BIGINT NOT NULL DEFAULT 0,
  output_tokens           BIGINT NOT NULL DEFAULT 0,
  total_tokens            BIGINT NOT NULL DEFAULT 0,
  duration_ms             INTEGER,
  time_to_first_token_ms  INTEGER,
  is_stream               BOOLEAN NOT NULL DEFAULT FALSE,
  is_success              BOOLEAN NOT NULL DEFAULT TRUE,
  error_message           TEXT,
  created_at              BIGINT NOT NULL       -- Unix 秒
);

CREATE INDEX idx_ai_proxy_logs_proxy ON ai_proxy_logs(proxy_id);
CREATE INDEX idx_ai_proxy_logs_created ON ai_proxy_logs(created_at);
```

---

## Schema 版本管理

所有 migration 文件存放在 `common-spec/migrations/`，使用 **golang-migrate** 格式：

```
common-spec/
└── migrations/
    ├── 000001_init_registry_instances.up.sql
    ├── 000001_init_registry_instances.down.sql
    ├── 000002_init_registry_sessions.up.sql
    ├── 000002_init_registry_sessions.down.sql
    ├── 000003_init_registry_roles.up.sql
    ├── 000003_init_registry_roles.down.sql
    └── ...
```

运行 migration：

```bash
# 使用 common-spec 提供的迁移工具
migrate -database "postgres://..." -path migrations up

# 或通过 openzerg-cli
oz db migrate
oz db rollback
oz db status
```

---

## 数据访问约定

### 各服务读写权限

| 服务 | 可写的表 | 可读的表 |
|------|---------|---------|
| registry | registry_instances, api_keys, registry_sessions（元数据字段）, registry_workers | 全部 |
| agent | registry_sessions（state, runner_instance_id, tokens）, registry_messages | registry_sessions, registry_messages, registry_roles, role_mcp_servers |
| zcp-skill | registry_roles, role_mcp_servers, skills, role_skills, memory, todos | — |
| channel | chatrooms, chatroom_members, chatroom_messages | — |
| ai-proxy | ai_proxy_provider_model_configs, ai_proxy_proxies, ai_proxy_logs | ai_proxy_provider_model_configs, ai_proxy_proxies, ai_proxy_logs |

### PostgreSQL 连接配置

所有服务统一通过 PgBouncer 连接：

```bash
# 环境变量（所有服务统一）
DATABASE_URL=postgresql://openzerg:${DB_PASSWORD}@localhost:5433/openzerg

# PgBouncer 配置
# pool_mode = transaction（事务级连接池）
# max_client_conn = 1000
# default_pool_size = 20
```
