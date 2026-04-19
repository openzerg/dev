# OpenZergUltra — Cluster Architecture

## Service Map

```
                         ┌──────────────────────────────────────────────────────┐
                         │                    overmind-webui                     │
                         │              SolidJS SPA :3000/:5173                  │
                         └──┬──────┬──────┬──────┬──────┬───────────────────────┘
                            │      │      │      │      │
                 ConnectRPC │      │      │      │      │ ConnectRPC
                            ▼      ▼      ▼      ▼      ▼
              ┌─────────────────────────────────────────────────────┐
              │               nginx reverse proxy :80/:443          │
              │  /api/registry/*  /api/agent/*  /api/wm/*           │
              │  /api/tsm/*       /api/skills/*  /api/ai-proxy/*    │
              └──┬──────┬──────┬──────┬──────┬──────┬───────────────┘
                 │      │      │      │      │      │
    ┌────────────┘      │      │      │      │      └──────────────┐
    ▼                   ▼      ▼      ▼      ▼                     ▼
┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐  ┌───────────────┐  ┌──────────┐
│ Registry │  │  Agent   │ │   WM     │ │   TSM    │  │  Skill Mgr    │  │ AI Proxy │
│  :25000  │  │  :25100  │ │  :25020  │ │  :25021  │  │   :15345      │  │  :15316  │
└────┬─────┘  └────┬─────┘ └────┬─────┘ └────┬─────┘  └───────────────┘  └────┬─────┘
     │             │            │            │                               │
     │  calls WM   │  calls TSM │            │  calls tool-server            │
     ├────────────►├───────────►│            │  instances via                │
     │             │            │            │  ToolServiceClient            │
     │  calls TSM  │  calls     │            │                               │
     ├────────────►│ AiProxy    │            │                               │
     │             │ (optional) │            │                               │
     │             │            │            │                               │
     ▼             ▼            ▼            ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL (shared DB)                                  │
│  registry_instances │ session_templates │ registry_sessions │ registry_messages │
│  registry_skills    │ wm_workspaces     │ wm_workers        │ cached_tools      │
│  ai_proxy_*         │                   │                   │                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │                              │
                    ┌─────────┴────────┐           ┌─────────┴────────┐
                    │   Podman Daemon   │           │   k3s Cluster    │
                    │   (dev/test)      │           │   (production)   │
                    └──────────────────┘           └──────────────────┘
```

## Service Details

### 1. Registry — :25000

**Responsibilities:** Auth, service discovery, Template CRUD, Session CRUD, Message CRUD.

**ConnectRPC Service:** `registry.v1.RegistryService`

| RPC | Description |
|-----|-------------|
| `login` | Authenticate with API key, return userToken |
| `register` | Self-register as a service instance (Agent, Worker, AI-Proxy call this) |
| `heartbeat` | Keep-alive for registered instances |
| `listInstances` | List all registered service instances |
| `listTemplates` / `getTemplate` / `createTemplate` / `updateTemplate` / `deleteTemplate` | Session template (role) CRUD |
| `listSessions` / `getSession` / `createSession` / `updateSessionMeta` / `updateSessionHotConfig` / `updateSessionColdConfig` / `switchSessionTemplate` / `deleteSession` / `startSession` / `stopSession` / `resolveSession` | Session lifecycle management |
| `listMessages` / `createMessage` / `deleteMessagesFrom` | Chat message CRUD |

**Calls as client:**
- **Workspace Manager** — `createWorkspace`, `ensureWorkspaceWorker`, `stopWorker`, `deleteWorkspace`
- **Tool Server Manager** — `resolveTools`

**DB tables:** `registry_instances`, `session_templates`, `registry_sessions`, `registry_messages`, `registry_skills`

### 2. Workspace Manager (WM) — :25020

**Responsibilities:** Workspace volume CRUD, Worker Pod lifecycle (one Worker Pod per workspace).

**ConnectRPC Service:** `workspacemanager.v1.WorkspaceManagerService`

| RPC | Description |
|-----|-------------|
| `health` | Health check |
| `createWorkspace` | Create a Podman volume / k8s PVC, insert DB record |
| `listWorkspaces` / `getWorkspace` | Workspace read |
| `deleteWorkspace` | Stop+remove Worker Pod, remove volume, delete DB record |
| `startWorker` | Start a Worker Pod (legacy per-session, kept for compat) |
| `stopWorker` / `getWorkerStatus` / `listWorkers` | Worker lifecycle queries |
| `ensureWorkspaceWorker` | **Idempotent**: return existing running worker or create new one for workspace. Mounts skill hostMounts. |
| `updateWorkspaceConfig` | Update skillSlugs / nixPkgs on a workspace (triggers Worker Pod rebuild) |

**Calls as client:** None. Uses `PodClient` (PodmanPodClient or KubernetesClient) directly.

**DB tables:** `wm_workspaces`, `wm_workers`

### 3. Tool Server Manager (TSM) — :25021

**Responsibilities:** Tool server Pod lifecycle, tool cache, tool discovery, tool routing + execution.

**ConnectRPC Service:** `toolservermanager.v1.ToolServerManagerService`

| RPC | Description |
|-----|-------------|
| `health` | Health check |
| `startToolServer` | Start a tool-server Pod (tool-fs, tool-web, tool-memory, tool-job) |
| `stopToolServer` | Stop+remove a tool-server Pod |
| `listToolServers` | List all running tool servers |
| `refreshToolCache` | Re-scan a tool-server instance for its available tools |
| `resolveTools` | Given session + tool-server types, return tool definitions + system context |
| `executeTool` | Route a tool call to the correct tool-server instance |

**Calls as client:** `ToolServiceClient` (dynamic URLs per tool-server instance) for `listTools` and `executeTool`. Uses `PodClient` for container management.

**DB tables:** `cached_tools` (reads `registry_instances` from shared DB)

### 4. Worker — :25001 (inside Pod)

**Responsibilities:** exec/spawn/fs RPC for tool servers, dynamic nix package installation.

**ConnectRPC Service:** `worker.v1.WorkerService` (Bearer token auth via `WORKER_SECRET`)

| RPC | Description |
|-----|-------------|
| `exec` | Execute a command synchronously with optional bwrap sandbox |
| `spawn` | Execute a command asynchronously (background job) |
| `readFile` / `writeFile` / `stat` | Filesystem operations inside workspace |
| `installPackages` | Dynamic nix profile install (idempotent) |
| `health` | Health check |

**Architecture:** One Worker Pod per workspace. Tool servers call Worker for filesystem access. Worker auto-sources env.sh before every exec/spawn command. bwrap sandbox mounts: `/usr`, `/lib`, `/nix`, `/data` (workspace), `/skills` (read-only).

**Calls as client:** Registry — `register`, `heartbeat` (on bootstrap).

### 5. Agent — :25100

**Responsibilities:** LLM loop, runs 10+ sessions concurrently, calls TSM for tools.

**ConnectRPC Service:** `agent.v1.AgentService`

| RPC | Type | Description |
|-----|------|-------------|
| `chat` | Unary | Send a user message, trigger LLM loop |
| `interrupt` | Unary | Abort current LLM generation |
| `deleteMessagesFrom` | Unary | Delete messages from a given message ID onward |
| `subscribeSessionEvents` | **Server-streaming** | Real-time event stream (thinking, response, tool_call, tool_result, done, error, todo_update) |
| `health` | Unary | Health check |

**Calls as client:**
- Registry — `register`, `heartbeat`
- TSM — `resolveTools`, `executeTool`
- AI Proxy (optional) — provider/model resolution

### 6. AI Proxy — :15316

**Responsibilities:** OpenAI-compatible API gateway, provider config CRUD, proxy routing, token usage logging.

**ConnectRPC Service:** `ai_proxy.v1.AiProxyService`

| RPC | Description |
|-----|-------------|
| `listProxies` / `getProxy` / `createProxy` / `updateProxy` / `deleteProxy` | Proxy CRUD (maps source model → provider config) |
| `listProviderModelConfigs` / `getProviderModelConfig` / `createProviderModelConfig` / `updateProviderModelConfig` / `deleteProviderModelConfig` | Provider model config CRUD |
| `listProviders` / `listProviderModels` | Provider template discovery (from models.dev) |
| `queryLogs` / `getTokenStats` | Token usage analytics |
| `testProviderModelConfig` / `testProxy` | Test connectivity to upstream provider |

**Additional HTTP endpoint:** `POST /v1/chat/completions` — OpenAI-compatible passthrough (streaming + non-streaming).

**Calls as client:** Registry — `register`, `heartbeat` (via raw HTTP fetch, not client lib).

**DB tables:** `ai_proxy_provider_model_configs`, `ai_proxy_proxies`, `ai_proxy_logs`

### 7. Skill Manager — :15345

**Responsibilities:** Git-based skill repository management.

**ConnectRPC Service:** `skillmanager.v1.SkillManagerService`

| RPC | Description |
|-----|-------------|
| `registerSkill` | Clone a git repo to `/var/lib/openzerg/skills/<slug>/` |
| `updateSkill` | Pull latest changes for a skill |
| `deleteSkill` | Remove a skill directory |
| `listSkills` / `getSkill` | Skill discovery |

**Calls as client:** None. Independent service.

## Inter-Service Communication

### Session Creation Flow

```
WebUI                Registry              WM                Podman/k3s
  │                    │                    │                    │
  │ createSession()    │                    │                    │
  │───────────────────►│                    │                    │
  │                    │  createWorkspace() │                    │
  │                    │───────────────────►│                    │
  │                    │                    │  createVolume()    │
  │                    │                    │───────────────────►│
  │                    │  {workspaceId}     │                    │
  │                    │◄───────────────────│                    │
  │  {sessionId}       │                    │                    │
  │◄───────────────────│                    │                    │
```

### Session Start Flow (Workspace-Session N:1)

```
WebUI          Registry           WM              Podman/k3s       TSM          Tool-Servers
  │               │                │                  │              │               │
  │ startSession()│                │                  │              │               │
  │──────────────►│                │                  │              │               │
  │               │ ensureWorkspace│                  │              │               │
  │               │    Worker()    │                  │              │               │
  │               │───────────────►│                  │              │               │
  │               │                │  createPod()     │              │               │
  │               │                │  (w/ hostMounts) │              │               │
  │               │                │─────────────────►│              │               │
  │               │  {workerInfo}  │                  │              │               │
  │               │◄───────────────│                  │              │               │
  │               │                │                  │              │               │
  │               │  resolveTools()│                  │              │               │
  │               │────────────────│──────────────────│─────────────►│               │
  │               │                │                  │              │ listTools()    │
  │               │                │                  │              │───────────────►│
  │               │  {toolDefs}    │                  │              │               │
  │               │◄───────────────│──────────────────│◄─────────────│               │
  │  {started}    │                │                  │              │               │
  │◄──────────────│                │                  │              │               │
```

### Chat Flow (Agent → TSM → Tool Servers → Worker)

```
WebUI           Agent              TSM           Tool-Server       Worker
  │               │                 │                │                │
  │ chat()        │                 │                │                │
  │──────────────►│                 │                │                │
  │               │  resolveTools() │                │                │
  │               │────────────────►│                │                │
  │               │                 │  listTools()   │                │
  │               │                 │───────────────►│                │
  │               │  {tools}        │                │                │
  │               │◄────────────────│                │                │
  │               │                 │                │                │
  │               │  [LLM stream via AI Proxy / direct provider]     │
  │               │                 │                │                │
  │               │  executeTool()  │                │                │
  │               │────────────────►│                │                │
  │               │                 │  executeTool() │                │
  │               │                 │───────────────►│                │
  │               │                 │                │  exec()/fs()   │
  │               │                 │                │───────────────►│
  │               │                 │  {result}      │                │
  │               │◄────────────────│◄───────────────│                │
  │               │                 │                │                │
  │  [SSE events: thinking, response, tool_call, tool_result, done]  │
  │◄──────────────│                 │                │                │
```

### Session Stop (No Worker Stop)

```
WebUI          Registry           WM
  │               │                │
  │ stopSession() │                │
  │──────────────►│                │
  │               │ [updates DB]   │
  │               │ [does NOT call WM.stopWorker]  │
  │  {stopped}    │                │
  │◄──────────────│                │
```

### Session Delete (Reference Counting)

```
WebUI          Registry           WM              Podman/k3s
  │               │                │                  │
  │ deleteSession()│               │                  │
  │──────────────►│                │                  │
  │               │ [count sessions│                  │
  │               │  with same     │                  │
  │               │  workspaceId]  │                  │
  │               │                │                  │
  │               │ [if last]      │                  │
  │               │ deleteWorkspace│                  │
  │               │───────────────►│                  │
  │               │                │  stopPod()       │
  │               │                │─────────────────►│
  │               │                │  removePod()     │
  │               │                │─────────────────►│
  │               │                │  removeVolume()  │
  │               │                │─────────────────►│
  │  {deleted}    │                │                  │
  │◄──────────────│                │                  │
```

## PodClient Abstraction

```
                    ┌────────────────────┐
                    │   interface        │
                    │   PodClient        │
                    ├────────────────────┤
                    │ createPod()        │
                    │ startPod()         │
                    │ stopPod()          │
                    │ removePod()        │
                    │ inspectPod()       │
                    │ listPods()         │
                    │ createVolume()     │
                    │ removeVolume()     │
                    └────────┬───────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
    ┌───────────▼──────────┐  ┌──────────▼───────────┐
    │  PodmanPodClient     │  │  KubernetesClient     │
    │  (dev/test)          │  │  (production)         │
    │                      │  │                       │
    │  Libpod API:         │  │  k8s REST API:        │
    │  /v4.0.0/libpod/pods │  │  /api/v1/namespaces/  │
    │  Docker API:         │  │  Bearer token + TLS   │
    │  /v1.44/volumes      │  │  PVC for volumes      │
    └──────────────────────┘  │  Pod for containers   │
                              └───────────────────────┘
```

## Worker Pod Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Worker Pod                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 bwrap sandbox                         │   │
│  │                                                       │   │
│  │  /data/workspace/  ← volume mount (read-write)        │   │
│  │  /skills/<slug>/   ← hostMount (read-only)            │   │
│  │  /usr /lib /bin    ← --ro-bind from host              │   │
│  │  /nix              ← --ro-bind-try (nix store)        │   │
│  │  /opt/nix-profile  ← --ro-bind-try (installed pkgs)   │   │
│  │                                                       │   │
│  │  env.sh auto-sourced before every exec/spawn:         │   │
│  │    PATH=/opt/nix-profile/bin:/usr/bin:...             │   │
│  │    LD_LIBRARY_PATH=/opt/nix-profile/lib:...           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  /opt/nix-profile/     ← nix profile install target         │
│  /tmp/openzerg-worker-state/env.sh ← generated env file     │
│                                                              │
│  RPC: exec, spawn, readFile, writeFile, stat, installPkg    │
└─────────────────────────────────────────────────────────────┘
```

## Database Table Ownership

| Service | Tables |
|---------|--------|
| Registry | `registry_instances`, `session_templates`, `registry_sessions`, `registry_messages`, `registry_skills` |
| WM | `wm_workspaces`, `wm_workers` |
| TSM | `cached_tools` |
| AI Proxy | `ai_proxy_provider_model_configs`, `ai_proxy_proxies`, `ai_proxy_logs` |
| Agent | None (reads session config from shared DB) |
| Worker | None (stateless inside Pod) |
| Skill Manager | None (git-based, filesystem only) |

## Port Allocation

| Service | Default Port | Env Var |
|---------|-------------|---------|
| Registry | 25000 | `PORT` |
| Workspace Manager | 25020 | hardcoded |
| Tool Server Manager | 25021 | `PORT` |
| Worker | 25001 | `PORT` |
| Agent | 25100 | `AGENT_PORT` |
| AI Proxy | 15316 | `AI_PROXY_PORT` |
| Skill Manager | 15345 | `PORT` |
| nginx | 80/443 | — |
| WebUI dev | 3000/5173 | — |
