import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { createServer, type Server } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { randomUUID } from "node:crypto"
import { mkdirSync, rmSync } from "node:fs"
import { ResultAsync } from "neverthrow"

import { RegistryClient, ToolServiceClient, type IWorkspaceManager, type IToolServerManager } from "@openzerg/common"
import type { Result } from "neverthrow"
import type { AppError } from "@openzerg/common"

import { PodmanCompose, waitForPort } from "./compose-helper.js"
import { openDB, autoMigrate } from "../../registry/src/db.js"
import { createRegistryRouter } from "../../registry/src/router.js"
import { createWorkerRouter, authInterceptor } from "../../worker/src/router.js"
import { createToolServer, SessionResolver, aggregatePkgs } from "@openzerg/tool-server-sdk"
import { createFsTools } from "../../tool-fs/src/tools/index.js"
import { createJobTools } from "../../tool-job/src/tools/index.js"

const PG_PORT = 15433
const PG_URL = `postgres://e2e:e2e@127.0.0.1:${PG_PORT}/e2e_fullchain`
const REGISTRY_PORT = 25300
const WORKER_PORT = 25301
const TOOL_FS_PORT = 25310
const TOOL_JOB_PORT = 25311
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

const mockWM: IWorkspaceManager = {
  health: () => ResultAsync.fromPromise(Promise.resolve({ status: "ok" } as any), () => new Error("fail") as any),
  createWorkspace: (_sessionId: string) =>
    ResultAsync.fromPromise(
      Promise.resolve({ workspaceId: randomUUID(), volumeName: `ws-${randomUUID().slice(0, 12)}` }),
      () => new Error("fail") as any,
    ),
  listWorkspaces: () => ResultAsync.fromPromise(Promise.resolve({ workspaces: [] } as any), () => new Error("fail") as any),
  getWorkspace: (_id: string) => ResultAsync.fromPromise(Promise.resolve({} as any), () => new Error("fail") as any),
  deleteWorkspace: (_workspaceId: string) =>
    ResultAsync.fromPromise(Promise.resolve({}), () => new Error("fail") as any),
  startWorker: (_req: any) =>
    ResultAsync.fromPromise(
      Promise.resolve({ workerId: randomUUID(), containerName: "worker-test", secret: "test-secret" }),
      () => new Error("fail") as any,
    ),
  stopWorker: (_workerId: string) =>
    ResultAsync.fromPromise(Promise.resolve({}), () => new Error("fail") as any),
  getWorkerStatus: (_workerId: string) => ResultAsync.fromPromise(Promise.resolve({} as any), () => new Error("fail") as any),
  listWorkers: () => ResultAsync.fromPromise(Promise.resolve({ workers: [] } as any), () => new Error("fail") as any),
  ensureWorkspaceWorker: (_req: any) =>
    ResultAsync.fromPromise(
      Promise.resolve({ workerId: randomUUID(), containerName: "worker-test", secret: "test-secret", volumeName: "ws-test" }),
      () => new Error("fail") as any,
    ),
  updateWorkspaceConfig: (_req: any) =>
    ResultAsync.fromPromise(Promise.resolve({}), () => new Error("fail") as any),
}

const mockTSM: IToolServerManager = {
  health: () => ResultAsync.fromPromise(Promise.resolve({ status: "ok" } as any), () => new Error("fail") as any),
  startToolServer: (_req: any) => ResultAsync.fromPromise(Promise.resolve({} as any), () => new Error("fail") as any),
  stopToolServer: (_type: string) => ResultAsync.fromPromise(Promise.resolve({} as any), () => new Error("fail") as any),
  listToolServers: () => ResultAsync.fromPromise(Promise.resolve({ toolServers: [] } as any), () => new Error("fail") as any),
  refreshToolCache: (_type: string) => ResultAsync.fromPromise(Promise.resolve({} as any), () => new Error("fail") as any),
  resolveTools: (_sessionId: string, _types: string[]) =>
    ResultAsync.fromPromise(
      Promise.resolve({ tools: [], systemContext: "", toolServerUrls: [] as any[] }),
      () => new Error("fail") as any,
    ),
  executeTool: (_req: any) =>
    ResultAsync.fromPromise(
      Promise.resolve({ resultJson: "", success: false, error: "mock" }),
      () => new Error("fail") as any,
    ),
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

  const regHandler = connectNodeAdapter({ routes: createRegistryRouter(db, mockWM, mockTSM) })
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

  const tpl = unwrap(await registryClient.createTemplate({
    name: "e2e-template",
    description: "e2e test template",
    systemPrompt: "You are a test assistant",
  }))

  const sess = unwrap(await registryClient.createSession({
    title: "e2e-fullchain",
    templateId: tpl.id,
  }))
  sessionId = sess.sessionId
  sessionToken = sess.sessionToken

  const fsResolver = new SessionResolver({
    registryUrl: `http://localhost:${REGISTRY_PORT}`,
    registryToken: "",
  })
  const fsHandler = connectNodeAdapter({
    routes: createToolServer({ tools: createFsTools(), getContext: (tok) => fsResolver.resolve(tok) }),
  })
  const fsServer = createServer(fsHandler)
  fsServer.listen(TOOL_FS_PORT)
  servers.push(fsServer)

  const jobResolver = new SessionResolver({
    registryUrl: `http://localhost:${REGISTRY_PORT}`,
    registryToken: "",
  })
  const jobHandler = connectNodeAdapter({
    routes: createToolServer({ tools: createJobTools(), getContext: (tok) => jobResolver.resolve(tok) }),
  })
  const jobServer = createServer(jobHandler)
  jobServer.listen(TOOL_JOB_PORT)
  servers.push(jobServer)

  toolFsClient = new ToolServiceClient({ baseURL: `http://localhost:${TOOL_FS_PORT}` })
  toolJobClient = new ToolServiceClient({ baseURL: `http://localhost:${TOOL_JOB_PORT}` })

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

  test("registry: updateSessionMeta changes title", async () => {
    const result = unwrap(await registryClient.updateSessionMeta({
      sessionId,
      title: "updated-title",
    }))
    expect(result.title).toBe("updated-title")
  })

  test("registry: template hot config update", async () => {
    const templates = unwrap(await registryClient.listTemplates())
    const tpl = templates.templates.find(r => r.name === "e2e-template")
    expect(tpl).toBeDefined()

    const updated = unwrap(await registryClient.updateTemplate({
      id: tpl!.id,
      name: "e2e-template",
      description: "e2e test template",
      systemPrompt: "Updated prompt",
    }))
    expect(updated.systemPrompt).toBe("Updated prompt")
  })

  test("tool-fs: listTools returns all fs tools", async () => {
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

  test("tool-fs: write -> read roundtrip", async () => {
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

  test("tool-fs: multi-edit across a file", async () => {
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

  test("tool-fs: apply-patch adds and updates files", async () => {
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

  test("tool-job: job-run -> job-output -> job-list", async () => {
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

  test("tool-fs tools declare pkgs", async () => {
    const tools = createFsTools()
    const pkgs = aggregatePkgs(tools)
    expect(pkgs).toContain("ripgrep")
  })
})
