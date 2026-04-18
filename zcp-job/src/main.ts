import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { createZcpServer, SessionResolver, bootstrapZcpService, aggregatePkgs } from "@openzerg/zcp"
import { createJobTools } from "./tools/index.js"

const PORT = parseInt(process.env.PORT ?? "25011", 10)
const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:25000"
const REGISTRY_TOKEN = process.env.REGISTRY_TOKEN ?? ""
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://zcp-job:${PORT}`
const HEARTBEAT_SEC = parseInt(process.env.HEARTBEAT_INTERVAL_SEC ?? "30", 10)

async function main() {
  const resolver = new SessionResolver({
    registryUrl: REGISTRY_URL,
    registryToken: REGISTRY_TOKEN,
  })

  const tools = createJobTools()

  const handler = connectNodeAdapter({
    routes: createZcpServer({
      tools,
      getContext: (token) => resolver.resolve(token),
      systemContext: `# Job Execution Tools\n\nProvides background job spawning and monitoring via the worker.\nJobs run asynchronously with status tracking (pending/running/completed/failed).`,
    }),
  })

  createServer(handler).listen(PORT, async () => {
    console.log(`zcp-job listening on :${PORT}`)

    if (REGISTRY_URL) {
      await bootstrapZcpService({
        registryUrl: REGISTRY_URL,
        registryToken: REGISTRY_TOKEN,
        instanceType: "zcp-job",
        port: PORT,
        publicUrl: PUBLIC_URL,
        nixPkgs: aggregatePkgs(tools),
        heartbeatIntervalSec: HEARTBEAT_SEC,
      })
    }
  })
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
