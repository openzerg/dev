import { describe, test, expect, beforeAll } from "bun:test"
import { WorkerClient } from "@openzerg/common"
import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { createWorkerRouter, authInterceptor } from "../src/router.js"
import type { Result } from "neverthrow"
import type { ExecResponse, SpawnResponse } from "@openzerg/common/gen/worker/v1_pb.js"
import type { AppError } from "@openzerg/common"

const WORKER_SECRET = "test-secret-123"
const PORT = 25099

let client: WorkerClient

beforeAll(async () => {
  process.env.WORKER_SECRET = WORKER_SECRET

  const handler = connectNodeAdapter({
    routes: createWorkerRouter(),
    interceptors: [authInterceptor()],
  })

  const server = createServer(handler)
  server.listen(PORT)
  await new Promise(r => setTimeout(r, 100))

  client = new WorkerClient({
    baseURL: `http://localhost:${PORT}`,
    token: WORKER_SECRET,
  })
})

function unwrapExec(result: Result<ExecResponse, AppError>): ExecResponse {
  if (result.isOk()) return result.value
  throw result.error
}

function unwrapSpawn(result: Result<SpawnResponse, AppError>): SpawnResponse {
  if (result.isOk()) return result.value
  throw result.error
}

describe("worker integration (via ConnectRPC)", () => {
  test("exec echo", async () => {
    const resp = unwrapExec(await client.exec({ command: "echo hello from zcp-fs" }))
    expect(resp.exitCode).toBe(0)
    expect(new TextDecoder().decode(resp.stdout).trim()).toBe("hello from zcp-fs")
  })

  test("exec cat nonexistent file", async () => {
    const resp = unwrapExec(await client.exec({ command: "cat /no/such/file" }))
    expect(resp.exitCode).toBe(1)
  })

  test("exec with env", async () => {
    const resp = unwrapExec(await client.exec({
      command: "echo $TEST_VAR",
      env: { TEST_VAR: "injected" },
    }))
    expect(resp.exitCode).toBe(0)
    expect(new TextDecoder().decode(resp.stdout).trim()).toBe("injected")
  })

  test("spawn + check files via exec", async () => {
    const jobId = crypto.randomUUID()
    const resp = unwrapSpawn(await client.spawn({
      jobId,
      command: "echo bg-output && sleep 0.1",
    }))
    expect(resp.started).toBe(true)

    await new Promise(r => setTimeout(r, 300))

    const check = unwrapExec(await client.exec({
      command: `cat /tmp/worker-jobs/${jobId}/stdout`,
    }))
    expect(check.exitCode).toBe(0)
    expect(new TextDecoder().decode(check.stdout).trim()).toBe("bg-output")
  })

  test("rejects bad token", async () => {
    const badClient = new WorkerClient({
      baseURL: `http://localhost:${PORT}`,
      token: "wrong-token",
    })
    const result = await badClient.exec({ command: "echo hi" })
    expect(result.isErr()).toBe(true)
  })
})
