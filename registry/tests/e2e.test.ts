import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { createServer, type Server } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { RegistryClient } from "@openzerg/common"
import type { Result } from "neverthrow"
import { PodmanCompose, waitForPort } from "../../openzerg/e2e/compose-helper.js"
import { openDB, autoMigrate } from "../src/db.js"
import { createRegistryRouter } from "../src/router.js"
import { createMockPodman } from "./mock-podman.js"
import type { PodmanClient } from "../src/podman/client.js"
import type { AppError } from "@openzerg/common"

const PG_PORT = 15432
const PG_URL = `postgres://e2e:e2e@127.0.0.1:${PG_PORT}/e2e_test`
const REGISTRY_PORT = 25200
const COMPOSE_FILE = import.meta.dir + "/compose.yaml"

const compose = new PodmanCompose({
  projectName: "registry",
  composeFile: COMPOSE_FILE,
})

let client: RegistryClient
let server: Server

function unwrap<T>(result: Result<T, AppError>): T {
  if (result.isOk()) return result.value
  throw result.error
}

beforeAll(async () => {
  process.env.MASTER_API_KEY = "test-master-key"
  await compose.up(["postgres"])
  await waitForPort(PG_PORT, 30_000)
  let migrated = false
  for (let i = 0; i < 10; i++) {
    try { await autoMigrate(PG_URL); migrated = true; break } catch { await new Promise(r => setTimeout(r, 1000)) }
  }
  if (!migrated) throw new Error("autoMigrate failed after 10 retries")
  const db = openDB(PG_URL)
  const podman = createMockPodman() as unknown as PodmanClient

  const handler = connectNodeAdapter({
    routes: createRegistryRouter(db, podman, "localhost/openzerg/worker:latest"),
  })

  server = createServer(handler)
  server.listen(REGISTRY_PORT)
  await new Promise(r => setTimeout(r, 100))

  client = new RegistryClient({
    baseURL: `http://localhost:${REGISTRY_PORT}`,
    token: "",
  })
}, 60_000)

afterAll(async () => {
  server?.close()
  await compose.down()
})

describe("registry E2E", () => {
  test("login with valid key", async () => {
    const result = await client.login("test-master-key")
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.userToken).toBeTruthy()
      expect(result.value.expiresInSec).toBe(86400)
    }
  })

  test("login with invalid key", async () => {
    const result = await client.login("wrong-key")
    expect(result.isErr()).toBe(true)
  })

  test("register instance", async () => {
    const result = await client.register({
      name: "test-worker",
      instanceType: "worker",
      ip: "127.0.0.1",
      port: 25001,
      publicUrl: "http://localhost:25001",
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.instanceId).toBeTruthy()
      expect(result.value.serviceToken).toBeTruthy()
    }
  })

  test("heartbeat", async () => {
    const reg = unwrap(await client.register({
      name: "hb-worker",
      instanceType: "worker",
      ip: "127.0.0.1",
      port: 25002,
      publicUrl: "http://localhost:25002",
    }))
    const hb = await client.heartbeat(reg.instanceId)
    expect(hb.isOk()).toBe(true)
  })

  test("listInstances filters by type", async () => {
    await client.register({
      name: "list-worker",
      instanceType: "worker",
      ip: "127.0.0.1",
      port: 25003,
      publicUrl: "http://localhost:25003",
    })
    const result = await client.listInstances("worker")
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.instances.length).toBeGreaterThanOrEqual(1)
      for (const inst of result.value.instances) {
        expect(inst.instanceType).toBe("worker")
      }
    }
  })

  test("role CRUD with hot/workspace config split", async () => {
    const created = unwrap(await client.createRole({
      name: "e2e-role",
      description: "test role",
      systemPrompt: "You are a test assistant",
      aiProxyId: "",
      zcpServers: "[]",
      skills: "[]",
      extraPkgs: "[]",
      maxSteps: 10,
    }))
    expect(created.name).toBe("e2e-role")
    expect(created.extraPkgs).toBe("[]")

    const hot = unwrap(await client.updateRoleHotConfig({
      id: created.id,
      systemPrompt: "Updated hot prompt",
      aiProxyId: "",
      skills: "[]",
      maxSteps: 20,
    }))
    expect(hot.systemPrompt).toBe("Updated hot prompt")
    expect(hot.maxSteps).toBe(20)

    const ws = unwrap(await client.updateRoleWorkspaceConfig({
      id: created.id,
      name: "e2e-role",
      description: "updated desc",
      zcpServers: '[{"type":"zcp-fs"}]',
      extraPkgs: '["ripgrep"]',
    }))
    expect(ws.zcpServers).toBe('[{"type":"zcp-fs"}]')
    expect(ws.extraPkgs).toBe('["ripgrep"]')

    const fetched = unwrap(await client.getRole(created.id))
    expect(fetched.systemPrompt).toBe("Updated hot prompt")
    expect(fetched.extraPkgs).toBe('["ripgrep"]')

    const del = await client.deleteRole(created.id)
    expect(del.isOk()).toBe(true)
  })

  test("session lifecycle: create → stop → delete", async () => {
    const role = unwrap(await client.createRole({
      name: "session-test-role",
      systemPrompt: "test",
      zcpServers: "[]",
      skills: "[]",
      extraPkgs: "[]",
    }))

    const created = unwrap(await client.createSession({
      title: "e2e session",
      roleId: role.id,
    }))
    expect(created.sessionId).toBeTruthy()
    expect(created.sessionToken).toBeTruthy()
    expect(created.session?.state).toBe("stopped")

    const fetched = unwrap(await client.getSession(created.sessionId))
    expect(fetched.workspaceId).toBeTruthy()

    const del = await client.deleteSession(created.sessionId)
    expect(del.isOk()).toBe(true)

    await client.deleteRole(role.id)
  })

  test("workspace management: list + delete", async () => {
    const workspaces = unwrap(await client.listWorkspaces())
    expect(Array.isArray(workspaces.workspaces)).toBe(true)
  })

  test("message CRUD", async () => {
    const role = unwrap(await client.createRole({
      name: "msg-test-role",
      systemPrompt: "test",
      zcpServers: "[]",
      skills: "[]",
      extraPkgs: "[]",
    }))

    const session = unwrap(await client.createSession({
      title: "msg test",
      roleId: role.id,
    }))

    const msg = unwrap(await client.createMessage({
      sessionId: session.sessionId,
      role: "user",
      content: "Hello E2E",
    }))
    expect(msg.messageId).toBeTruthy()

    const msgs = unwrap(await client.listMessages({
      sessionId: session.sessionId,
      limit: 10,
    }))
    expect(msgs.messages.length).toBeGreaterThanOrEqual(1)
    expect(msgs.messages[0].content).toBe("Hello E2E")

    await client.deleteSession(session.sessionId)
    await client.deleteRole(role.id)
  })
})
