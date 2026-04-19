import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { createServer, type Server } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { rmSync, mkdirSync } from "node:fs"

import { WorkerClient } from "@openzerg/common"
import { createWorkerRouter, authInterceptor } from "../../worker/src/router.js"
import type { ToolContext } from "../../tool-server-sdk/src/tool.js"
import { createJobTools } from "../src/tools/index.js"

const PORT = 25102
const SECRET = "job-test-secret"
const WORKSPACE = "/tmp/zcp-job-test-workspace"

let server: Server

const mockGetContext = (_token: string): Promise<ToolContext> =>
  Promise.resolve({
    sessionId: "test-session",
    workerUrl: `http://localhost:${PORT}`,
    workerSecret: SECRET,
    workspaceRoot: WORKSPACE,
    serverConfigs: {},
  })

const jobTools = createJobTools()

function findTool(name: string) {
  const tool = jobTools.find(t => t.name === name)
  if (!tool) throw new Error(`Tool not found: ${name}`)
  return tool
}

async function execTool(tool: ReturnType<typeof findTool>, args: Record<string, unknown>): Promise<any> {
  const result = await tool!.execute(JSON.stringify(args), "tok", mockGetContext)
  if (result.isErr()) throw result.error
  return result.value
}

async function execToolRaw(tool: ReturnType<typeof findTool>, argsJson: string): Promise<any> {
  const result = await tool!.execute(argsJson, "tok", mockGetContext)
  if (result.isErr()) throw result.error
  return result.value
}

beforeAll(async () => {
  process.env.WORKER_SECRET = SECRET

  const handler = connectNodeAdapter({
    routes: createWorkerRouter(),
    interceptors: [authInterceptor()],
  })
  server = createServer(handler)
  server.listen(PORT)
  await new Promise(r => setTimeout(r, 100))

  rmSync(WORKSPACE, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
})

afterAll(() => {
  server?.close()
  rmSync(WORKSPACE, { recursive: true, force: true })
})

describe("worker direct (sanity)", () => {
  test("client.exec works", async () => {
    const client = new WorkerClient({ baseURL: `http://localhost:${PORT}`, token: SECRET })
    const result = await client.exec({ command: "echo direct-works" })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(new TextDecoder().decode(result.value.stdout).trim()).toBe("direct-works")
    }
  })

  test("client.spawn works", async () => {
    const client = new WorkerClient({ baseURL: `http://localhost:${PORT}`, token: SECRET })
    const jobId = crypto.randomUUID()
    const result = await client.spawn({ jobId, command: "echo spawned-direct" })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.started).toBe(true)
    }
  })

  test("client.spawn with workdir", async () => {
    const client = new WorkerClient({ baseURL: `http://localhost:${PORT}`, token: SECRET })
    const jobId = crypto.randomUUID()
    const result = await client.spawn({ jobId, command: "echo in-workdir", workdir: WORKSPACE })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.started).toBe(true, `spawn failed: ${result.value.error}`)
    }
  })
})

describe("zcp-job tools (via ConnectRPC + file RPCs)", () => {
  test("job-run spawns and job-output returns result", async () => {
    const run = findTool("job-run")
    const output = findTool("job-output")

    const runResult = await execTool(run, { command: "echo hello-job" })
    expect(runResult.jobId).toBeDefined()

    await new Promise(r => setTimeout(r, 300))

    const outResult = await execTool(output, { jobId: runResult.jobId })
    expect(outResult.stdout.trim()).toBe("hello-job")
    expect(outResult.running).toBe(false)
    expect(outResult.exitCode).toBe(0)
  })

  test("job-output while still running", async () => {
    const run = findTool("job-run")
    const output = findTool("job-output")

    const runResult = await execTool(run, { command: "echo slow && sleep 2 && echo done" })

    await new Promise(r => setTimeout(r, 100))

    const outResult = await execTool(output, { jobId: runResult.jobId })
    expect(outResult.running).toBe(true)
    expect(outResult.exitCode).toBeNull()

    await new Promise(r => setTimeout(r, 2500))

    const finalResult = await execTool(output, { jobId: runResult.jobId })
    expect(finalResult.running).toBe(false)
    expect(finalResult.exitCode).toBe(0)
    expect(finalResult.stdout).toContain("slow")
    expect(finalResult.stdout).toContain("done")
  })

  test("job-output with offset", async () => {
    const run = findTool("job-run")
    const output = findTool("job-output")

    const runResult = await execTool(run, { command: "echo abcdefghijklmnop" })

    await new Promise(r => setTimeout(r, 300))

    const fullResult = await execTool(output, { jobId: runResult.jobId })

    const fullBytes = new TextEncoder().encode(fullResult.stdout)
    if (fullBytes.length > 3) {
      const offsetResult = await execTool(output, { jobId: runResult.jobId, offset: 3 })
      const offsetBytes = new TextEncoder().encode(offsetResult.stdout)
      expect(offsetBytes.length).toBe(fullBytes.length - 3)
    }
  })

  test("job-list returns jobs", async () => {
    const run = findTool("job-run")
    const list = findTool("job-list")

    const r1 = await execTool(run, { command: "echo job1" })
    const r2 = await execTool(run, { command: "echo job2" })

    await new Promise(r => setTimeout(r, 300))

    const listResult = await execToolRaw(list, "{}")
    const jobIds = listResult.jobs.map((j: any) => j.jobId)
    expect(jobIds).toContain(r1.jobId)
    expect(jobIds).toContain(r2.jobId)

    for (const j of listResult.jobs) {
      if (j.jobId === r1.jobId || j.jobId === r2.jobId) {
        expect(j.running).toBe(false)
        expect(j.exitCode).toBe(0)
      }
    }
  })

  test("job-kill stops a running job", async () => {
    const run = findTool("job-run")
    const kill = findTool("job-kill")
    const output = findTool("job-output")

    const runResult = await execTool(run, { command: "sleep 60" })

    await new Promise(r => setTimeout(r, 100))

    const killResult = await execTool(kill, { jobId: runResult.jobId })
    expect(killResult.success).toBe(true)

    await new Promise(r => setTimeout(r, 500))

    const outResult = await execTool(output, { jobId: runResult.jobId })
    expect(outResult.running).toBe(false)
  })

  test("job-run with failing command returns non-zero exit code", async () => {
    const run = findTool("job-run")
    const output = findTool("job-output")

    const runResult = await execTool(run, { command: "exit 42" })

    await new Promise(r => setTimeout(r, 300))

    const outResult = await execTool(output, { jobId: runResult.jobId })
    expect(outResult.running).toBe(false)
    expect(outResult.exitCode).toBe(42)
  })

  test("job-run captures stderr", async () => {
    const run = findTool("job-run")
    const output = findTool("job-output")

    const runResult = await execTool(run, { command: "echo err-msg >&2" })

    await new Promise(r => setTimeout(r, 300))

    const outResult = await execTool(output, { jobId: runResult.jobId })
    expect(outResult.stderr.trim()).toBe("err-msg")
    expect(outResult.exitCode).toBe(0)
  })
})
