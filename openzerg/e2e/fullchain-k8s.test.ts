import { describe, test, beforeAll, afterAll, expect } from "bun:test"
import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { RegistryClient, WorkspaceManagerClient, ToolServerManagerClient } from "@openzerg/common"
import { KubernetesClient } from "@openzerg/pod-client"
import { openDB as openRegDB, autoMigrate as regMigrate } from "../../registry/src/db.js"
import { createRegistryRouter } from "../../registry/src/router.js"
import { openDB as openWmDB, autoMigrate as wmMigrate } from "../../workspace-manager/src/db.js"
import { createWorkspaceManagerRouter } from "../../workspace-manager/src/router.js"
import { openDB as openTsmDB, autoMigrate as tsmMigrate } from "../../tool-server-manager/src/db.js"
import { createTSMRouter } from "../../tool-server-manager/src/router.js"
import { execSync } from "node:child_process"
import { randomUUID } from "node:crypto"

const REG_PG_PORT = 15444
const WM_PG_PORT = 15445
const TSM_PG_PORT = 15446
const REG_PORT = 25360
const WM_PORT = 25361
const TSM_PORT = 25362

function startPg(name: string, port: number, db: string) {
  try { execSync(`podman rm -f ${name}`, { stdio: "pipe" }) } catch {}
  execSync(
    `podman run -d --name ${name} -p ${port}:5432 ` +
    `-e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=${db} ` +
    `docker.io/library/postgres:17-alpine`,
    { stdio: "pipe" },
  )
}

async function waitForMigrate(migrateFn: (url: string) => Promise<void>, url: string) {
  for (let i = 0; i < 15; i++) {
    try { await migrateFn(url); return } catch { await new Promise(r => setTimeout(r, 1000)) }
  }
  throw new Error("migration failed")
}

let regDb: Awaited<ReturnType<typeof openRegDB>>
let wmDb: Awaited<ReturnType<typeof openWmDB>>
let tsmDb: Awaited<ReturnType<typeof openTsmDB>>
let regServer: ReturnType<typeof createServer>
let wmServer: ReturnType<typeof createServer>
let tsmServer: ReturnType<typeof createServer>
let registry: RegistryClient
let wm: WorkspaceManagerClient
let tsm: ToolServerManagerClient

beforeAll(async () => {
  const k8s = new KubernetesClient()

  startPg("e2e-fc-k8s-reg-pg", REG_PG_PORT, "e2e_fc_k8s_reg")
  startPg("e2e-fc-k8s-wm-pg", WM_PG_PORT, "e2e_fc_k8s_wm")
  startPg("e2e-fc-k8s-tsm-pg", TSM_PG_PORT, "e2e_fc_k8s_tsm")

  const regUrl = `postgres://e2e:e2e@127.0.0.1:${REG_PG_PORT}/e2e_fc_k8s_reg`
  const wmUrl = `postgres://e2e:e2e@127.0.0.1:${WM_PG_PORT}/e2e_fc_k8s_wm`
  const tsmUrl = `postgres://e2e:e2e@127.0.0.1:${TSM_PG_PORT}/e2e_fc_k8s_tsm`

  await Promise.all([
    waitForMigrate(regMigrate, regUrl),
    waitForMigrate(wmMigrate, wmUrl),
    waitForMigrate(tsmMigrate, tsmUrl),
  ])

  regDb = openRegDB(regUrl)
  wmDb = openWmDB(wmUrl)
  tsmDb = openTsmDB(tsmUrl)

  const wmReal = new WorkspaceManagerClient({ baseURL: `http://localhost:${WM_PORT}` })
  const tsmReal = new ToolServerManagerClient({ baseURL: `http://localhost:${TSM_PORT}` })

  const regHandler = connectNodeAdapter({ routes: createRegistryRouter(regDb, wmReal, tsmReal) })
  regServer = createServer(regHandler)
  await new Promise<void>(r => regServer.listen(REG_PORT, () => r()))

  const wmHandler = connectNodeAdapter({ routes: createWorkspaceManagerRouter(wmDb, k8s) })
  wmServer = createServer(wmHandler)
  await new Promise<void>(r => wmServer.listen(WM_PORT, () => r()))

  const tsmHandler = connectNodeAdapter({ routes: createTSMRouter(tsmDb, k8s) })
  tsmServer = createServer(tsmHandler)
  await new Promise<void>(r => tsmServer.listen(TSM_PORT, () => r()))

  registry = new RegistryClient({ baseURL: `http://localhost:${REG_PORT}` })
  wm = new WorkspaceManagerClient({ baseURL: `http://localhost:${WM_PORT}` })
  tsm = new ToolServerManagerClient({ baseURL: `http://localhost:${TSM_PORT}` })
}, 60_000)

afterAll(async () => {
  regServer?.close()
  wmServer?.close()
  tsmServer?.close()
  regDb?.destroy()
  wmDb?.destroy()
  tsmDb?.destroy()
  for (const name of ["e2e-fc-k8s-reg-pg", "e2e-fc-k8s-wm-pg", "e2e-fc-k8s-tsm-pg"]) {
    try { execSync(`podman rm -f ${name}`, { stdio: "pipe" }) } catch {}
  }
}, 30_000)

describe("Fullchain E2E — k3s Kubernetes", () => {
  test("create session creates PVC via k8s WM", async () => {
    const tpl = await registry.createTemplate({
      name: "k8s-fc-tpl",
      systemPrompt: "k8s test",
    })
    expect(tpl.isOk()).toBe(true)
    if (!tpl.isOk()) return

    const session = await registry.createSession({
      title: "k8s fullchain",
      templateId: tpl.value.id,
    })
    expect(session.isOk()).toBe(true)
    if (!session.isOk()) return
    expect(session.value.session?.workspaceId).toBeTruthy()

    const wsList = await wm.listWorkspaces()
    expect(wsList.isOk()).toBe(true)
    if (!wsList.isOk()) return
    expect(wsList.value.workspaces.length).toBeGreaterThanOrEqual(1)

    await registry.deleteSession(session.value.sessionId)
    await registry.deleteTemplate(tpl.value.id)
  }, 30_000)

  test("start session creates k8s Worker Pod", async () => {
    const tpl = await registry.createTemplate({
      name: "k8s-start-tpl",
      systemPrompt: "k8s start",
    })
    expect(tpl.isOk()).toBe(true)
    if (!tpl.isOk()) return

    const session = await registry.createSession({
      title: "k8s start test",
      templateId: tpl.value.id,
    })
    expect(session.isOk()).toBe(true)
    if (!session.isOk()) return

    process.env.WORKER_IMAGE = "docker.io/library/alpine:latest"
    const started = await registry.startSession(session.value.sessionId)
    expect(started.isOk()).toBe(true)

    const workers = await wm.listWorkers()
    expect(workers.isOk()).toBe(true)
    if (!workers.isOk()) return
    expect(workers.value.workers.length).toBeGreaterThanOrEqual(1)

    await registry.stopSession(session.value.sessionId)
    await registry.deleteSession(session.value.sessionId)
    await registry.deleteTemplate(tpl.value.id)
  }, 30_000)

  test("WM ensureWorkspaceWorker creates k8s Pod", async () => {
    const ws = await wm.createWorkspace(randomUUID())
    expect(ws.isOk()).toBe(true)
    if (!ws.isOk()) return

    const worker = await wm.ensureWorkspaceWorker({
      workspaceId: ws.value.workspaceId,
      image: "docker.io/library/alpine:latest",
    })
    expect(worker.isOk()).toBe(true)
    if (!worker.isOk()) return

    const status = await wm.getWorkerStatus(worker.value.workerId)
    expect(status.isOk()).toBe(true)

    await wm.deleteWorkspace(ws.value.workspaceId)
  }, 30_000)

  test("TSM can start and list tool servers via k8s", async () => {
    const result = await tsm.startToolServer({
      type: "tool-fs-k8s-fc",
      image: "docker.io/library/alpine:latest",
      command: ["sleep", "60"],
      env: {},
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    const list = await tsm.listToolServers()
    expect(list.isOk()).toBe(true)
    if (!list.isOk()) return
    const found = list.value.servers.find(s => s.type === "tool-fs-k8s-fc")
    expect(found).toBeDefined()

    await tsm.stopToolServer("tool-fs-k8s-fc")
  }, 30_000)
})
