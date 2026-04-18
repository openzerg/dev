import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { createWorkerRouter, authInterceptor } from "./router.js"
import { bootstrap, stopHeartbeat } from "./bootstrap.js"

const PORT = parseInt(process.env.PORT ?? "25001", 10)
const REGISTRY_URL = process.env.REGISTRY_URL ?? ""
const REGISTRY_TOKEN = process.env.REGISTRY_TOKEN ?? ""
const WORKER_NAME = process.env.WORKER_NAME ?? `worker-${Date.now()}`
const HEARTBEAT_SEC = parseInt(process.env.HEARTBEAT_INTERVAL_SEC ?? "30", 10)

async function main() {
  const handler = connectNodeAdapter({
    routes: createWorkerRouter(),
    interceptors: [authInterceptor()],
  })

  createServer(handler).listen(PORT, async () => {
    console.log(`worker listening on :${PORT}`)

    if (REGISTRY_URL) {
      await bootstrap({
        registryUrl: REGISTRY_URL,
        registryToken: REGISTRY_TOKEN,
        workerName: WORKER_NAME,
        port: PORT,
        heartbeatIntervalSec: HEARTBEAT_SEC,
      })
    }
  })
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

process.on("SIGTERM", () => {
  stopHeartbeat()
  process.exit(0)
})
