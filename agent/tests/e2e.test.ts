import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { createServer, type Server } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { AgentClient } from "@openzerg/common"
import { openDB, type DB } from "../src/db/index.js"
import { EventBus } from "../src/event-bus/index.js"
import { SessionStateManager } from "../src/service/session-state.js"
import { AgentLoop } from "../src/service/agent-loop.js"
import { createAgentRouter } from "../src/router.js"
import { PodmanCompose, waitForPort } from "../../openzerg/e2e/compose-helper.js"
import { randomUUID } from "node:crypto"

const AGENT_PORT = 25099
const DATABASE_URL = `postgres://e2e:e2e@127.0.0.1:15433/e2e_fullchain`

const UPSTREAM = "https://coding.dashscope.aliyuncs.com/v1"
const API_KEY = process.env.TEST_API_KEY || "sk-test-placeholder"
const MODEL_ID = "qwen3.6-plus"

let compose: PodmanCompose
let db: DB
let server: Server
let agentClient: AgentClient

beforeAll(async () => {
  compose = new PodmanCompose({
    projectName: "agent-e2e",
    composeFile: "/home/admin/OpenZergUltra/openzerg/e2e/compose.yaml",
  })
  await compose.up()
  await waitForPort(15433, 30_000)

  await new Promise(r => setTimeout(r, 2000))

  db = openDB(DATABASE_URL)
  for (let i = 0; i < 10; i++) {
    try {
      await autoMigrate(db)
      break
    } catch (e: any) {
      if (i === 9) throw e
      console.log(`[e2e] retry migration ${i + 1}: ${e.message}`)
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  const rows = await db.selectFrom("ai_proxy_provider_model_configs").selectAll().execute()
  console.log(`[e2e] provider_model_configs rows: ${rows.length}`)

  const eventBus = new EventBus()
  const stateManager = new SessionStateManager()
  const agentLoop = new AgentLoop(db, eventBus, stateManager, null)
  const router = createAgentRouter(db, agentLoop, eventBus, stateManager)

  server = createServer(connectNodeAdapter({ routes: router }))
  server.listen(AGENT_PORT)
  await waitForPort(AGENT_PORT, 5_000)

  agentClient = new AgentClient({
    baseURL: `http://127.0.0.1:${AGENT_PORT}`,
    token: "test",
  })
}, 60_000)

afterAll(async () => {
  server?.close()
  await db?.destroy()
  await compose?.down()
})

async function autoMigrate(db: DB) {
  await db.schema.createTable("registry_instances").ifNotExists()
    .addColumn("id", "text", c => c.notNull().primaryKey())
    .addColumn("name", "text", c => c.notNull())
    .addColumn("instanceType", "text", c => c.notNull())
    .addColumn("ip", "text", c => c.notNull())
    .addColumn("port", "integer", c => c.notNull())
    .addColumn("publicUrl", "text", c => c.notNull())
    .addColumn("lifecycle", "text", c => c.notNull().defaultTo("active"))
    .addColumn("lastSeen", "bigint", c => c.notNull().defaultTo(0n))
    .addColumn("metadata", "text", c => c.notNull().defaultTo("{}"))
    .addColumn("createdAt", "bigint", c => c.notNull())
    .addColumn("updatedAt", "bigint", c => c.notNull())
    .execute()

  await db.schema.createTable("registry_roles").ifNotExists()
    .addColumn("id", "text", c => c.notNull().primaryKey())
    .addColumn("name", "text", c => c.notNull().unique())
    .addColumn("description", "text", c => c.notNull().defaultTo(""))
    .addColumn("systemPrompt", "text", c => c.notNull().defaultTo(""))
    .addColumn("aiProxyId", "text", c => c.notNull().defaultTo(""))
    .addColumn("zcpServers", "text", c => c.notNull().defaultTo("[]"))
    .addColumn("skills", "text", c => c.notNull().defaultTo("[]"))
    .addColumn("extraPkgs", "text", c => c.notNull().defaultTo("[]"))
    .addColumn("maxSteps", "integer", c => c.notNull().defaultTo(50))
    .addColumn("createdAt", "bigint", c => c.notNull())
    .addColumn("updatedAt", "bigint", c => c.notNull())
    .execute()

  await db.schema.createTable("registry_sessions").ifNotExists()
    .addColumn("id", "text", c => c.notNull().primaryKey())
    .addColumn("title", "text", c => c.notNull().defaultTo(""))
    .addColumn("roleId", "text", c => c.notNull())
    .addColumn("workerId", "text", c => c.notNull().defaultTo(""))
    .addColumn("agentId", "text", c => c.notNull().defaultTo(""))
    .addColumn("sessionToken", "text", c => c.notNull().unique())
    .addColumn("state", "text", c => c.notNull().defaultTo("idle"))
    .addColumn("workspaceId", "text", c => c.notNull().defaultTo(""))
    .addColumn("inputTokens", "bigint", c => c.notNull().defaultTo(0n))
    .addColumn("outputTokens", "bigint", c => c.notNull().defaultTo(0n))
    .addColumn("lastActiveAt", "bigint", c => c.notNull().defaultTo(0n))
    .addColumn("createdAt", "bigint", c => c.notNull())
    .addColumn("updatedAt", "bigint", c => c.notNull())
    .execute()

  await db.schema.createTable("registry_messages").ifNotExists()
    .addColumn("id", "text", c => c.notNull().primaryKey())
    .addColumn("sessionId", "text", c => c.notNull())
    .addColumn("role", "text", c => c.notNull())
    .addColumn("parentMessageId", "text", c => c.notNull().defaultTo(""))
    .addColumn("toolCallId", "text", c => c.notNull().defaultTo(""))
    .addColumn("toolName", "text", c => c.notNull().defaultTo(""))
    .addColumn("content", "text", c => c.notNull().defaultTo(""))
    .addColumn("tokenUsage", "text", c => c.notNull().defaultTo("{}"))
    .addColumn("metadata", "text", c => c.notNull().defaultTo("{}"))
    .addColumn("compacted", "boolean", c => c.notNull().defaultTo(false))
    .addColumn("createdAt", "bigint", c => c.notNull())
    .execute()

  await db.schema.createTable("ai_proxy_provider_model_configs").ifNotExists()
    .addColumn("id", "text", c => c.notNull().primaryKey())
    .addColumn("providerId", "text", c => c.notNull())
    .addColumn("providerName", "text", c => c.notNull())
    .addColumn("modelId", "text", c => c.notNull())
    .addColumn("modelName", "text", c => c.notNull())
    .addColumn("upstream", "text", c => c.notNull())
    .addColumn("apiKey", "text", c => c.notNull())
    .addColumn("supportStreaming", "boolean", c => c.notNull().defaultTo(true))
    .addColumn("supportTools", "boolean", c => c.notNull().defaultTo(true))
    .addColumn("supportVision", "boolean", c => c.notNull().defaultTo(false))
    .addColumn("supportReasoning", "boolean", c => c.notNull().defaultTo(false))
    .addColumn("defaultMaxTokens", "integer", c => c.notNull().defaultTo(4096))
    .addColumn("contextLength", "integer", c => c.notNull().defaultTo(0))
    .addColumn("autoCompactLength", "integer", c => c.notNull().defaultTo(0))
    .addColumn("enabled", "boolean", c => c.notNull().defaultTo(true))
    .addColumn("createdAt", "bigint", c => c.notNull())
    .addColumn("updatedAt", "bigint", c => c.notNull())
    .execute()

  await db.schema.createTable("ai_proxy_proxies").ifNotExists()
    .addColumn("id", "text", c => c.notNull().primaryKey())
    .addColumn("sourceModel", "text", c => c.notNull().unique())
    .addColumn("providerModelConfigId", "text", c => c.notNull())
    .addColumn("apiKey", "text", c => c.notNull())
    .addColumn("enabled", "boolean", c => c.notNull().defaultTo(true))
    .addColumn("createdAt", "bigint", c => c.notNull())
    .addColumn("updatedAt", "bigint", c => c.notNull())
    .execute()

  const ts = BigInt(Date.now())
  const configId = randomUUID()
  await db.insertInto("ai_proxy_provider_model_configs").values({
    id: configId,
    providerId: "alibaba",
    providerName: "alibaba-coding-plan-cn",
    modelId: MODEL_ID,
    modelName: MODEL_ID,
    upstream: UPSTREAM,
    apiKey: API_KEY,
    supportStreaming: true,
    supportTools: true,
    supportVision: false,
    supportReasoning: true,
    defaultMaxTokens: 4096,
    contextLength: 131072,
    autoCompactLength: 100000,
    enabled: true,
    createdAt: ts,
    updatedAt: ts,
  }).execute()

  const proxyId = randomUUID()
  await db.insertInto("ai_proxy_proxies").values({
    id: proxyId,
    sourceModel: "alibaba-coding-plan-cn",
    providerModelConfigId: configId,
    apiKey: API_KEY,
    enabled: true,
    createdAt: ts,
    updatedAt: ts,
  }).execute()

  const roleId = randomUUID()
  await db.insertInto("registry_roles").values({
    id: roleId,
    name: "chat-test",
    description: "Test chat role",
    systemPrompt: "You are a helpful assistant. Reply in one short sentence.",
    aiProxyId: proxyId,
    zcpServers: "[]",
    skills: "[]",
    extraPkgs: "[]",
    maxSteps: 5,
    createdAt: ts,
    updatedAt: ts,
  }).execute()

  const sessionId = randomUUID()
  const sessionToken = `stk-${randomUUID()}`
  await db.insertInto("registry_sessions").values({
    id: sessionId,
    title: "E2E test session",
    roleId,
    workerId: "",
    agentId: "",
    sessionToken,
    state: "idle",
    workspaceId: "",
    inputTokens: 0n,
    outputTokens: 0n,
    lastActiveAt: 0n,
    createdAt: ts,
    updatedAt: ts,
  }).execute()

  console.log(`[e2e] setup complete: sessionId=${sessionId}, roleId=${roleId}, proxyId=${proxyId}`)
}

describe("Agent Phase 1 E2E", () => {
  test("health check", async () => {
    const result = await agentClient.health()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe("ok")
    }
  })

  test("chat returns SSE response via ConnectRPC streaming", async () => {
    const sessions = await db.selectFrom("registry_sessions").selectAll().execute()
    const sessionId = sessions[0].id
    console.log(`[e2e] chatting with session ${sessionId}`)

    const events: any[] = []
    const stream = agentClient.subscribeSessionEvents(sessionId)

    const chatResult = await agentClient.chat(sessionId, "What is 2+2? Reply in one sentence.")
    expect(chatResult.isOk()).toBe(true)

    for await (const event of stream) {
      events.push({ type: event.type, data: event.data })
      console.log(`[e2e] event: ${event.type}`)
      if (event.type === "done" || event.type === "error") break
    }

    const responseEvents = events.filter(e => e.type === "response" && e.data)
    expect(responseEvents.length).toBeGreaterThan(0)

    const fullContent = responseEvents
      .map(e => { try { return JSON.parse(e.data).content } catch { return "" } })
      .join("")
    console.log(`[e2e] full response: ${fullContent}`)
    expect(fullContent.length).toBeGreaterThan(0)

    const doneEvent = events.find(e => e.type === "done")
    expect(doneEvent).toBeDefined()

    const messages = await db.selectFrom("registry_messages").selectAll()
      .where("sessionId", "=", sessionId)
      .orderBy("createdAt", "asc").execute()
    expect(messages.length).toBeGreaterThanOrEqual(2)
    expect(messages[0].role).toBe("user")
    expect(messages[1].role).toBe("assistant")
  }, 30_000)
})
