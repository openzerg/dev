# Session 生命周期详细设计

## Session 状态机

```
                    CreateSession(roleId, workerId?)
                           │
                           ▼
                    ┌─────────────┐
                    │  [初始化]    │
                    │  建立 MCP   │
                    │  连接       │
                    └──────┬──────┘
                           │ 成功
                           ▼
          ┌────────────────────────────────┐
          │           [ Idle ]             │
          │   等待用户消息                   │
          └──────┬──────────────────────────┘
                 │ Chat() / ReceiveNotify()
                 ▼
          ┌─────────────────┐    工具调用循环
          │   [ Running ]   │◄──────────────────┐
          │  LLM 推理中     │                    │
          └──────┬──────────┘                    │
                 │                               │
       ┌─────────┴──────────┐                    │
       │ 无 tool_calls       │ 有 tool_calls      │
       │（LLM 回复完成）      │                    │
       ▼                    ▼                    │
  [ 写最终消息 ]     [ 执行工具集合 ]               │
       │            toolRouter.execute()         │
       │                    │ 所有工具完成 ────────┘
       ▼
  [ Idle ] ◄─── AbortController.abort() ─── [ Interrupted ]

       │ 触发压缩阈值（token 数超限）
       ▼
  [ Compacting ]
    读取全部历史 → LLM 生成摘要
    → 删除旧消息 → 插入摘要
       │
       ▼
  [ Running ]（继续未完成的推理）

       │ 超时不活跃
       ▼
  [ Suspended ]
    保留 worker 绑定
    MCP 连接可释放
    DB 状态完整保留

       │ Chat() 重新激活
       ▼
  [ Resume ]
    从 PostgreSQL 加载消息历史
    重建 MCP 连接（ToolRouter.rebuild）
       │
       ▼
  [ Running ]

       │ 显式 DeleteSession()
       ▼
  [ Deleted ]
    解除 worker 绑定
    清理 MCP 连接
    删除 PostgreSQL 记录（级联删除 messages/todos）
```

---

## 状态转换详细说明

### 创建 → Idle

```
registry.CreateSession(roleId, workerId?)
  │
  ├── PostgreSQL INSERT sessions:
  │     { id, roleId, workerId, state="idle", workerBinding="active" }
  │
  ├── registry 选择负载最低的 agent 实例
  │     SELECT * FROM instances
  │     WHERE instance_type = 'agent'
  │       AND lifecycle = 'running'
  │     ORDER BY active_session_count ASC LIMIT 1
  │
  ├── registry 更新 sessions.runner_instance_id
  │
  └── registry 调用 runner.ResumeSession(sessionId, roleId, workerId)
        runner 内部：
          1. 从 PostgreSQL 读取 role 配置（mcpServers[]）
          2. 如有 workerId：调用 WorkerService.GetMCPEndpoints()
          3. 为每个 mcpServer.url 创建 ToolServiceClient
          4. 调用各 client.listTools() 聚合路由表
          5. 设置 SessionRuntimeState.state = 'idle'
```

### Idle → Running

```
用户发送消息：registry.Chat(sessionId, "帮我分析这段代码")
  │
  ├── registry 查 PostgreSQL：sessions.runner_instance_id = runner-B
  ├── registry 调用 runner-B.ReceiveMessage(sessionId, content)
  │
  └── runner-B 内部：
        1. PostgreSQL INSERT messages: { role="user", content, seq=N+1 }
        2. 发出 EventBus.emit("user_message_saved", {sessionId})
        3. state → "running"
        4. 进入 LLM 推理循环

LLM 推理循环（processSession）：
  ┌─────────────────────────────────────────────────────────┐
  │ while (hasToolCalls && iterations < MAX_ITERATIONS=50): │
  │                                                         │
  │   1. 构建 messages（从 PostgreSQL 读取历史 + system）    │
  │   2. 获取工具列表（toolRouter.getLLMTools()）            │
  │   3. 调用 ai-proxy /v1/chat/completions（流式）          │
  │      逐 chunk 发出 response 事件（→ registry → WebUI）  │
  │                                                         │
  │   4. 如有 tool_calls：                                  │
  │      - 并行执行所有工具（Promise.all）                   │
  │      - 每个工具：                                       │
  │        a. 发出 tool_call 事件                           │
  │        b. toolRouter.execute(name, argsJson, token)      │
  │           → ConnectRPC → worker/zcp-skill/channel     │
  │        c. PostgreSQL INSERT message(role="tool", ...)   │
  │        d. 发出 tool_result 事件                         │
  │      - 将所有工具结果追加到 messages[]                   │
  │      - 继续下一轮 LLM 调用                              │
  │                                                         │
  │   5. 如无 tool_calls：                                  │
  │      - hasToolCalls = false → 退出循环                  │
  └─────────────────────────────────────────────────────────┘

  6. PostgreSQL INSERT message(role="assistant", final_content)
  7. state → "idle"
  8. 发出 done 事件
  9. 检查 pendingMessage（Running 期间排队的消息）→ 递归处理
```

### Running → Compacting

```
自动触发条件：
  input_tokens > session.compact_threshold（默认 100,000）

  compacting 流程：
    1. state → "compacting"
    2. 发出 compacting 事件（告知 WebUI）
    3. 从 PostgreSQL 读取全部消息历史
    4. 构建压缩 prompt：
       "以下是对话历史，请生成简洁摘要：\n{history}"
    5. 调用 LLM 生成摘要（不带工具，max_tokens=2000）
    6. PostgreSQL 事务：
       a. 删除旧消息（保留 system messages）
       b. INSERT compacted_summary message
    7. state → "running"（继续推理）
    8. 发出 compacted 事件
```

### Running → Suspended（超时）

```
registry 心跳超时扫描（每 60s）：
  SELECT * FROM sessions
  WHERE state = 'idle'
    AND last_active_at < NOW() - INTERVAL '30 minutes'
    AND worker_binding = 'active'

对每个超时 session：
  1. PostgreSQL UPDATE sessions SET state='suspended', suspended_at=NOW()
  2. 通知 runner: runner.SuspendSession(sessionId)
  3. runner 内部：
     - 清理 SessionRuntimeState（释放 MCP 连接，节省内存）
     - 注意：worker 绑定不解除（sessions.worker_binding 保持 'active'）
```

### Suspended → Running（Resume）

```
用户重新发送消息：registry.Chat(sessionId, "继续")
  │
  ├── registry 查 PostgreSQL：session 当前 state='suspended'，无 runner_instance_id
  ├── registry 选择负载最低的 agent（重新分配，可能是不同实例）
  ├── 更新 sessions.runner_instance_id = new-runner-C
  │
  └── new-runner-C.ResumeSession(sessionId, roleId, workerId)
        1. 从 PostgreSQL 读取消息历史（最近 N 条，用于构建 context window）
        2. 重建 ToolRouter（重新连接所有 MCP servers）
        3. state → "idle"

   → 然后立即处理新消息（Idle → Running 流程）
```

---

## 聊天室 Session 的特殊处理

### @mention 触发新 Chatroom Session

```
Channel 收到消息（chatroomId="room-001", @dev-agent, "帮我 review PR #42"）
  │
  └── channel 调用 registry.RouteNotify("room-001", "dev-agent", "帮我 review PR #42")

registry.RouteNotify 逻辑：
  │
  ├── 查询 PostgreSQL：
  │     SELECT id, runner_instance_id, state
  │     FROM sessions
  │     WHERE external_id = "room-001"
  │       AND session_type = "chatroom"
  │       AND worker_binding != "released"
  │     ORDER BY last_active_at DESC LIMIT 1
  │
  ├── 情况 A：找到 active/suspended session
  │     → 按正常 Chat() 流程路由（Resume 如需要）
  │
  └── 情况 B：未找到（首次 @mention）
        1. 查询 dev-agent 的默认 chatroom role（从 instances/config 表）
        2. 创建新 Session：
             roleId = "chat"（默认聊天 role，通常无 worker）
             sessionType = "chatroom"
             externalId = "room-001"
        3. 按正常创建 → Idle → Running 流程
```

### Chatroom Session 的回复机制

LLM 在 chatroom session 中被 system prompt 指示：

```
"你必须使用 chatroom-message-send 工具发送所有回复。
不能只输出文本。使用 chatroom-info 工具了解频道成员。
在发送消息时，通过 mentions 字段 @提及需要通知的成员。"
```

因此 chatroom session 的推理结果不通过 `response` 事件流返回，而是通过工具调用 channel 的 chatroom-message-send 工具发送。

---

## 多 Session 并发处理

一个 agent 实例可以并发处理多个 Session：

```
agent 内部（以 TypeScript 异步为例）：

ReceiveMessage(sessionId, content):
  if session.state === 'running':
    // 排队等待，不立即处理
    session.pendingMessage = content
    return

  // 否则立即启动推理（不阻塞当前 request handler）
  processSession(sessionId, content)  // 后台异步，不 await
  return  // 立即返回给 registry
```

每个 Session 的推理循环独立异步运行，agent 的 event loop 不被阻塞。

---

## 工作区并发安全

多个 Session 并发访问同一个 Workspace 的安全边界：

| 操作 | 并发安全性 | 说明 |
|------|-----------|------|
| 文件读取 | ✅ 安全 | 只读，无冲突 |
| 文件写入（不同文件） | ✅ 安全 | 不同路径，无冲突 |
| 文件写入（相同文件） | ⚠️ 可能冲突 | LLM 负责避免，无系统级锁 |
| job-run（执行命令） | ✅ 安全 | 每个进程独立，不互相干扰 |
| job-list | ✅ 安全 | 返回全局进程列表，所有 session 共享视图 |
| job-kill | ⚠️ 需注意 | 一个 Session 可以 kill 另一个 Session 的进程（设计如此） |

> 工作区文件系统的并发写入冲突由 LLM 的工具调用语义负责，系统层面不加锁。这符合真实开发场景（多人协作时也可能冲突）。
