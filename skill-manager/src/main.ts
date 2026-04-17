import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { loadConfig } from "./config.js"
import { openDB, autoMigrate } from "./db.js"
import { createSkillManagerRouter } from "./router.js"

const cfg = loadConfig()

async function main() {
  await autoMigrate(cfg.databaseURL)
  const db = openDB(cfg.databaseURL)

  const handler = connectNodeAdapter({
    routes: createSkillManagerRouter(db, cfg.skillsDir),
  })

  createServer(handler).listen(cfg.port, () => {
    console.log(`skill-manager listening on :${cfg.port}`)
  })
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
