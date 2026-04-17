import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { createZcpServer, SessionResolver } from "@openzerg/zcp"
import { openMemoryDB, autoMigrate } from "./db.js"
import { createMemoryTools } from "./tools/index.js"

const PORT = parseInt(process.env.PORT ?? "25030", 10)
const DATABASE_URL = process.env.DATABASE_URL ?? ""
const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:25000"
const REGISTRY_TOKEN = process.env.REGISTRY_TOKEN ?? ""

async function main() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL is required")
    process.exit(1)
  }

  const db = openMemoryDB(DATABASE_URL)
  await autoMigrate(db)

  const resolver = new SessionResolver({
    registryUrl: REGISTRY_URL,
    registryToken: REGISTRY_TOKEN,
  })

  const tools = createMemoryTools(db)

  const handler = connectNodeAdapter({
    routes: createZcpServer({
      tools,
      getContext: (token) => resolver.resolve(token),
      systemContext: `# Memory & Todo Tools\n\nProvides persistent key-value memory and session task management.\nMemory is scoped per bucket (derived from session or configured via role).\nTodos are stored as a special key "__todos__" in the same bucket.`,
    }),
  })

  createServer(handler).listen(PORT, () => {
    console.log(`zcp-memory listening on :${PORT}`)
  })
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
