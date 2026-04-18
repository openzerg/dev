import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { createServer, type Server } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { randomUUID } from "node:crypto"
import { mkdirSync, rmSync } from "node:fs"

import { RegistryClient, ToolServiceClient } from "@openzerg/common"
import type { Result } from "neverthrow"
import type { AppError } from "@openzerg/common"

import { PodmanCompose, waitForPort } from "./compose-helper.js"
import { openDB, autoMigrate } from "../../registry/src/db.js"
import { createRegistryRouter } from "../../registry/src/router.js"
import { createWorkerRouter, authInterceptor } from "../../worker/src/router.js"
import { createZcpServer, SessionResolver, aggregatePkgs } from "@openzerg/zcp"
import { createFsTools } from "../../zcp-fs/src/tools/index.js"
import { createJobTools } from "../../zcp-job/src/tools/index.js"

const PG_PORT = 15433
const PG_URL = `postgres://e2e:e2e@127.0.0.1:${PG_PORT}/e2e_fullchain`
const REGISTRY_PORT = 25300
const WORKER_PORT = 25301
const ZCP_FS_PORT = 25310
const ZCP_JOB_PORT = 25311
const WORKSPACE = "/tmp/e2e-fullchain-workspace"

const WORKER_SECRET = randomUUID()

const compose = new PodmanCompose({
  projectName: "fullchain",
  composeFile: import.meta.dir + "/compose.yaml",
})

let servers: Server[] = []
let registryClient: RegistryClient
let toolFsClient: ToolServiceClient
let toolJobClient: ToolServiceClient
let sessionToken: string
let sessionId: string

function unwrap<T>(result: Result<T, AppError>): T {
  if (result.isOk()) return result.value
  throw result.error
}

function createMockPodman() {
  return {
    async createContainer() { return "mock-id" },
    async startContainer() {},
    async stopContainer() {},
    async removeContainer() {},
    async inspectContainer(nameOrId: string) {
      return { id: nameOrId, name: nameOrId, state: "running", status: "running" }
    },
    async createVolume() {},
    async removeVolume() {},
  }
}

beforeAll(async () => {
  process.env.MASTER_API_KEY = "e2e-master-key"
  process.env.WORKER_SECRET = WORKER_SECRET

  await compose.up(["postgres"])
  await waitForPort(PG_PORT, 30_000)

  let migrated = false
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await autoMigrate(PG_URL)
      migrated = true
      break
    } catch {
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  if (!migrated) throw new Error("autoMigrate failed after 10 retries")

  const db = openDB(PG_URL)
  const podman = createMockPodman() as any

  const regHandler = connectNodeAdapter({ routes: createRegistryRouter(db, podman, "localhost/openzerg/worker:latest") })
  const regServer = createServer(regHandler)
  regServer.listen(REGISTRY_PORT)
  servers.push(regServer)

  const workerHandler = connectNodeAdapter({
    routes: createWorkerRouter(),
    interceptors: [authInterceptor()],
  })
  const workerServer = createServer(workerHandler)
  workerServer.listen(WORKER_PORT)
  servers.push(workerServer)

  rmSync(WORKSPACE, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })

  registryClient = new RegistryClient({ baseURL: `http://localhost:${REGISTRY_PORT}` })

  const role = unwrap(await registryClient.createRole({
    name: "e2e-role",
    description: "e2e test role",
    systemPrompt: "You are a test assistant",
    zcpServers: "[]",
    skills: "[]",
    extraPkgs: "[]",
    maxSteps: 50,
  }))

  const sess = unwrap(await registryClient.createSession({
    title: "e2e-fullchain",
    roleId: role.id,
  }))
  sessionId = sess.sessionId
  sessionToken = sess.sessionToken

  const ts = BigInt(Math.floor(Date.now() / 1000))
  const workerId = randomUUID()
  await db.insertInto("registry_workers").values({
    id: workerId,
    name: "e2e-worker",
    containerName: `localhost:${WORKER_PORT}`,
    image: "worker:latest",
    secret: WORKER_SECRET,
    lifecycle: "running",
    workspaceRoot: WORKSPACE,
    filesystemUrl: "",
    executionUrl: "",
    createdAt: ts,
    updatedAt: ts,
  }).execute()

  await db.updateTable("registry_sessions").set({
    workerId,
    state: "idle",
    lastActiveAt: ts,
    updatedAt: ts,
  }).where("id", "=", sessionId).execute()

  const fsResolver = new SessionResolver({
    registryUrl: `http://localhost:${REGISTRY_PORT}`,
    registryToken: "",
  })
  const fsHandler = connectNodeAdapter({
    routes: createZcpServer({ tools: createFsTools(), getContext: (tok) => fsResolver.resolve(tok) }),
  })
  const fsServer = createServer(fsHandler)
  fsServer.listen(ZCP_FS_PORT)
  servers.push(fsServer)

  const jobResolver = new SessionResolver({
    registryUrl: `http://localhost:${REGISTRY_PORT}`,
    registryToken: "",
  })
  const jobHandler = connectNodeAdapter({
    routes: createZcpServer({ tools: createJobTools(), getContext: (tok) => jobResolver.resolve(tok) }),
  })
  const jobServer = createServer(jobHandler)
  jobServer.listen(ZCP_JOB_PORT)
  servers.push(jobServer)

  toolFsClient = new ToolServiceClient({ baseURL: `http://localhost:${ZCP_FS_PORT}` })
  toolJobClient = new ToolServiceClient({ baseURL: `http://localhost:${ZCP_JOB_PORT}` })

  await new Promise(r => setTimeout(r, 200))
}, 120_000)

afterAll(async () => {
  for (const s of servers) s.close()
  rmSync(WORKSPACE, { recursive: true, force: true })
  await compose.down()
})

describe("full chain E2E", () => {
  test("registry: session has workspaceId", async () => {
    const result = unwrap(await registryClient.getSession(sessionId))
    expect(result.workspaceId).toBeTruthy()
  })

  test("registry: resolveSession returns workspaceId", async () => {
    const result = unwrap(await registryClient.resolveSession(sessionToken))
    expect(result.workspaceId).toBeTruthy()
  })

  test("registry: listWorkspaces returns entries", async () => {
    const result = unwrap(await registryClient.listWorkspaces())
    expect(result.workspaces.length).toBeGreaterThanOrEqual(1)
  })

  test("registry: updateSessionMeta changes title", async () => {
    const result = unwrap(await registryClient.updateSessionMeta({
      sessionId,
      title: "updated-title",
    }))
    expect(result.title).toBe("updated-title")
  })

  test("registry: role hot config update", async () => {
    const roles = unwrap(await registryClient.listRoles())
    const role = roles.roles.find(r => r.name === "e2e-role")
    expect(role).toBeDefined()

    const updated = unwrap(await registryClient.updateRoleHotConfig({
      id: role!.id,
      systemPrompt: "Updated prompt",
      skills: "[]",
      maxSteps: 100,
    }))
    expect(updated.systemPrompt).toBe("Updated prompt")
    expect(updated.maxSteps).toBe(100)
  })

  test("zcp-fs: listTools returns all fs tools", async () => {
    const result = await toolFsClient.listTools()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const names = result.value.tools.map(t => t.name)
      expect(names).toContain("read")
      expect(names).toContain("write")
      expect(names).toContain("edit")
      expect(names).toContain("multi-edit")
      expect(names).toContain("apply-patch")
    }
  })

  test("zcp-fs: write → read roundtrip", async () => {
    const writeResult = await toolFsClient.executeTool(
      "write", JSON.stringify({ path: "hello.txt", content: "full chain E2E" }), sessionToken,
    )
    expect(writeResult.isOk()).toBe(true)
    if (!writeResult.isOk()) return
    expect(writeResult.value.success).toBe(true)

    const readResult = await toolFsClient.executeTool(
      "read", JSON.stringify({ path: "hello.txt" }), sessionToken,
    )
    expect(readResult.isOk()).toBe(true)
    if (!readResult.isOk()) return
    const data = JSON.parse(readResult.value.resultJson)
    expect(data.content).toContain("full chain E2E")
  })

  test("zcp-fs: multi-edit across a file", async () => {
    await toolFsClient.executeTool(
      "write", JSON.stringify({ path: "multi.txt", content: "alpha beta gamma" }), sessionToken,
    )
    const result = await toolFsClient.executeTool(
      "multi-edit", JSON.stringify({
        path: "multi.txt",
        edits: [
          { oldString: "alpha", newString: "ALPHA" },
          { oldString: "gamma", newString: "GAMMA" },
        ],
      }), sessionToken,
    )
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.success).toBe(true)

    const read = await toolFsClient.executeTool("read", JSON.stringify({ path: "multi.txt" }), sessionToken)
    if (read.isOk()) {
      const data = JSON.parse(read.value.resultJson)
      expect(data.content).toContain("ALPHA beta GAMMA")
    }
  })

  test("zcp-fs: apply-patch adds and updates files", async () => {
    await toolFsClient.executeTool(
      "write", JSON.stringify({ path: "patch-target.txt", content: "line1\nline2\nline3\n" }), sessionToken,
    )
    const patchText = `*** Begin Patch
*** Add File: added-by-patch.txt
+patched content
*** Update File: patch-target.txt
@@ line1
 line1
-line2
+LINE_TWO
 line3
*** End Patch`

    const result = await toolFsClient.executeTool("apply-patch", JSON.stringify({ patchText }), sessionToken)
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.success).toBe(true)

    const added = await toolFsClient.executeTool("read", JSON.stringify({ path: "added-by-patch.txt" }), sessionToken)
    if (added.isOk()) {
      const data = JSON.parse(added.value.resultJson)
      expect(data.content).toContain("patched content")
    }
  })

  test("zcp-job: job-run → job-output → job-list", async () => {
    const runResult = await toolJobClient.executeTool(
      "job-run", JSON.stringify({ command: "echo job-works && sleep 0.2" }), sessionToken,
    )
    expect(runResult.isOk()).toBe(true)
    if (!runResult.isOk()) return
    expect(runResult.value.success).toBe(true)
    const { jobId } = JSON.parse(runResult.value.resultJson)

    await new Promise(r => setTimeout(r, 500))

    const outputResult = await toolJobClient.executeTool(
      "job-output", JSON.stringify({ jobId }), sessionToken,
    )
    expect(outputResult.isOk()).toBe(true)
    if (outputResult.isOk()) {
      const out = JSON.parse(outputResult.value.resultJson)
      expect(out.running).toBe(false)
      expect(out.stdout.trim()).toBe("job-works")
    }

    const listResult = await toolJobClient.executeTool("job-list", "{}", sessionToken)
    expect(listResult.isOk()).toBe(true)
  })

  test("zcp-fs tools declare pkgs", async () => {
    const tools = createFsTools()
    const pkgs = aggregatePkgs(tools)
    expect(pkgs).toContain("ripgrep")
  })
})
