import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { RegistryClient, AiProxyClient } from "@openzerg/common"
import { openDB } from "./db/index.js"
import { EventBus } from "./event-bus/index.js"
import { SessionStateManager } from "./service/session-state.js"
import { AgentLoop } from "./service/agent-loop.js"
import { createAgentRouter } from "./router.js"
import { AGENT_PORT, REGISTRY_URL, DATABASE_URL, ADMIN_TOKEN, AI_PROXY_URL } from "./config.js"

async function main() {
  const db = openDB(DATABASE_URL)
  const eventBus = new EventBus()
  const stateManager = new SessionStateManager()

  const aiProxyClient = AI_PROXY_URL
    ? new AiProxyClient({ baseURL: AI_PROXY_URL, token: ADMIN_TOKEN })
    : null
  if (aiProxyClient) {
    console.log(`[agent] ai-proxy client enabled at ${AI_PROXY_URL}`)
  } else {
    console.log("[agent] no AI_PROXY_URL, will resolve providers from DB directly")
  }

  const agentLoop = new AgentLoop(db, eventBus, stateManager, aiProxyClient)
  const router = createAgentRouter(db, agentLoop, eventBus, stateManager)

  const handler = connectNodeAdapter({ routes: router })
  const server = createServer(handler)

  server.listen(AGENT_PORT, () => {
    console.log(`[agent] listening on :${AGENT_PORT}`)
  })

  const registry = new RegistryClient({ baseURL: REGISTRY_URL, token: ADMIN_TOKEN })
  const regResult = await registry.register({
    name: `agent-${process.pid}`,
    instanceType: "agent",
    ip: "127.0.0.1",
    port: AGENT_PORT,
    publicUrl: `http://127.0.0.1:${AGENT_PORT}`,
  })
  if (regResult.isOk()) {
    console.log(`[agent] registered to registry as ${regResult.value.instanceId}`)
  } else {
    console.warn(`[agent] failed to register to registry: ${regResult.error.message}`)
  }

  setInterval(async () => {
    if (regResult.isOk()) {
      await registry.heartbeat(regResult.value.instanceId)
    }
  }, 30_000)

  const shutdown = async () => {
    console.log("[agent] shutting down")
    await db.destroy()
    server.close()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((e) => {
  console.error("[agent] fatal:", e)
  process.exit(1)
})
