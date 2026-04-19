import { describe, test, expect, beforeAll, afterAll } from "bun:test"

const PROFILE_DIR = process.env.NIX_PROFILE_DIR
if (!PROFILE_DIR) {
  console.log("Skipping nix e2e: set NIX_PROFILE_DIR to run (e.g. /tmp/nix-profile-test)")
  process.exit(0)
}

import { createServer, type Server } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { createWorkerRouter, authInterceptor } from "../src/router.js"
import { WorkerClient } from "@openzerg/common"
import type { ExecResponse, InstallPackagesResponse } from "@openzerg/common/gen/worker/v1_pb.js"
import type { AppError } from "@openzerg/common"
import type { Result } from "neverthrow"

const SECRET = "e2e-nix-test"
const PORT = 25199

let client: WorkerClient
let server: Server

beforeAll(async () => {
  process.env.WORKER_SECRET = SECRET
  const handler = connectNodeAdapter({
    routes: createWorkerRouter(),
    interceptors: [authInterceptor()],
  })
  server = createServer(handler)
  await new Promise<void>(resolve => server.listen(PORT, resolve))
  client = new WorkerClient({ baseURL: `http://localhost:${PORT}`, token: SECRET })
})

afterAll(() => {
  server?.close()
})

function unwrapExec(r: Result<ExecResponse, AppError>): ExecResponse {
  if (r.isOk()) return r.value
  throw r.error
}

describe("Worker nix e2e: installPackages → exec", () => {
  test("health", async () => {
    const r = await client.health()
    expect(r.isOk()).toBe(true)
  })

  test("install hello package", async () => {
    const r = await client.installPackages(["hello"])
    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      console.log(`installed: ${r.value.installed}, failed: ${r.value.failed}`)
      expect(r.value.installed).toContain("hello")
      expect(r.value.failed.length).toBe(0)
    }
  })

  test("exec hello — binary available via profile", async () => {
    const r = unwrapExec(await client.exec({ command: "hello" }))
    const stdout = new TextDecoder().decode(r.stdout).trim()
    console.log(`hello output: ${stdout}`)
    expect(r.exitCode).toBe(0)
    expect(stdout.length).toBeGreaterThan(0)
  })

  test("install figlet + exec", async () => {
    const install = await client.installPackages(["figlet"])
    expect(install.isOk()).toBe(true)
    if (install.isOk()) {
      expect(install.value.installed).toContain("figlet")
    }

    const r = unwrapExec(await client.exec({ command: "figlet Hi" }))
    const stdout = new TextDecoder().decode(r.stdout).trim()
    console.log(`figlet output:\n${stdout}`)
    expect(r.exitCode).toBe(0)
    expect(stdout.length).toBeGreaterThan(0)
  })

  test("install fd + exec with env vars propagated", async () => {
    const install = await client.installPackages(["fd"])
    expect(install.isOk()).toBe(true)
    if (install.isOk()) {
      expect(install.value.installed).toContain("fd")
    }

    const r = unwrapExec(await client.exec({ command: "fd --version" }))
    const stdout = new TextDecoder().decode(r.stdout).trim()
    console.log(`fd version: ${stdout}`)
    expect(r.exitCode).toBe(0)
    expect(stdout).toMatch(/fd \d+/)
  })
})
