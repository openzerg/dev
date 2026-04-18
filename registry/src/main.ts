import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { loadConfig } from "./config.js"
import { openDB, autoMigrate } from "./db.js"
import { createRegistryRouter } from "./router.js"
import { startInfrastructure } from "./infrastructure.js"
import { createProxyHandler } from "./proxy.js"
import { now } from "./handlers/util.js"

const cfg = loadConfig()

async function main() {
  await autoMigrate(cfg.databaseURL)
  const db = openDB(cfg.databaseURL)

  const rpcHandler = connectNodeAdapter({
    routes: createRegistryRouter(db, cfg.podman, cfg.workerImage),
  })

  const proxyHandler = createProxyHandler(db)

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Connect-Protocol-Version, X-Registry-Token",
  }

  const handler = async (req: any, res: any) => {
    res.setHeader("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"])
    res.setHeader("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"])
    res.setHeader("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"])
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return }
    if (await proxyHandler(req, res)) return
    rpcHandler(req, res)
  }

  createServer(handler).listen(cfg.port, () => {
    console.log(`registry listening on :${cfg.port}`)
  })

  try {
    await startInfrastructure(cfg)
  } catch (err) {
    console.error("[registry] infrastructure startup failed:", err)
    console.error("[registry] services will need to be started manually")
  }

  setInterval(async () => {
    try {
      const threshold = now() - BigInt(cfg.idleTimeoutSec)
      const idleSessions = await db.selectFrom("registry_sessions").selectAll()
        .where("state", "=", "idle")
        .where("lastActiveAt", "<", threshold)
        .where("lastActiveAt", ">", 0n)
        .execute()

      for (const session of idleSessions) {
        console.log(`[registry] auto-stopping idle session ${session.id}`)
        const ts = now()
        await db.updateTable("registry_sessions").set({
          state: "stopped", workerId: "", updatedAt: ts,
        }).where("id", "=", session.id).execute()

        if (session.workspaceId) {
          await db.updateTable("registry_workspaces").set({
            state: "stopped", updatedAt: ts,
          }).where("id", "=", session.workspaceId).execute()
        }
      }
    } catch (err) {
      console.error("[registry] idle scanner error:", err)
    }
  }, 60_000)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
