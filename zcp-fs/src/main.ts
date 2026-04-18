import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { createZcpServer, SessionResolver, bootstrapZcpService, aggregatePkgs } from "@openzerg/zcp"
import { createFsTools } from "./tools/index.js"

const PORT = parseInt(process.env.PORT ?? "25010", 10)
const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:25000"
const REGISTRY_TOKEN = process.env.REGISTRY_TOKEN ?? ""
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://zcp-fs:${PORT}`
const HEARTBEAT_SEC = parseInt(process.env.HEARTBEAT_INTERVAL_SEC ?? "30", 10)

async function main() {
  const resolver = new SessionResolver({
    registryUrl: REGISTRY_URL,
    registryToken: REGISTRY_TOKEN,
  })

  const tools = createFsTools()

  const handler = connectNodeAdapter({
    routes: createZcpServer({
      tools,
      getContext: (token) => resolver.resolve(token),
      systemContext: `# Filesystem Tools\n\nProvides file read, write, edit, search (grep/glob), and directory listing tools.\nAll paths are relative to the workspace root resolved per session.`,
    }),
  })

  createServer(handler).listen(PORT, async () => {
    console.log(`zcp-fs listening on :${PORT}`)

    if (REGISTRY_URL) {
      await bootstrapZcpService({
        registryUrl: REGISTRY_URL,
        registryToken: REGISTRY_TOKEN,
        instanceType: "zcp-fs",
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
