import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { createToolServer, SessionResolver, bootstrapToolServer, aggregatePkgs } from "@openzerg/tool-server-sdk"
import { createJobTools } from "./tools/index.js"

const PORT = parseInt(process.env.PORT ?? "25011", 10)
const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:25000"
const REGISTRY_TOKEN = process.env.REGISTRY_TOKEN ?? ""
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://tool-job:${PORT}`
const HEARTBEAT_SEC = parseInt(process.env.HEARTBEAT_INTERVAL_SEC ?? "30", 10)

async function main() {
  const resolver = new SessionResolver({
    registryUrl: REGISTRY_URL,
    registryToken: REGISTRY_TOKEN,
  })

  const tools = createJobTools()

  const handler = connectNodeAdapter({
    routes: createToolServer({
      tools,
      getContext: (token) => resolver.resolve(token),
      systemContext: `# Job Execution Tools\n\nProvides background job spawning and monitoring via the worker.\nJobs run asynchronously with status tracking (pending/running/completed/failed).`,
    }),
  })

  createServer(handler).listen(PORT, async () => {
    console.log(`tool-job listening on :${PORT}`)

    if (REGISTRY_URL) {
      await bootstrapToolServer({
        registryUrl: REGISTRY_URL,
        registryToken: REGISTRY_TOKEN,
        instanceType: "tool-job",
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
