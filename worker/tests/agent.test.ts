import { describe, test, expect } from "bun:test"
import { runExec } from "../src/exec.js"
import { runSpawn } from "../src/spawn.js"
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Result } from "neverthrow"

const JOBS_DIR = "/tmp/worker-test-jobs"

function unwrap<T, E>(result: Result<T, E>): T {
  if (result.isOk()) return result.value
  throw new Error("unexpected err: " + JSON.stringify(result.error))
}

describe("worker exec", () => {
  test("runs simple command", async () => {
    const resp = unwrap(await runExec({
      command: "echo hello",
      workdir: "",
      env: {},
      timeoutMs: 0,
    } as any))
    expect(resp.exitCode).toBe(0)
    expect(new TextDecoder().decode(resp.stdout).trim()).toBe("hello")
  })

  test("captures stderr", async () => {
    const resp = unwrap(await runExec({
      command: "echo error >&2 && exit 1",
      workdir: "",
      env: {},
      timeoutMs: 0,
    } as any))
    expect(resp.exitCode).toBe(1)
    expect(new TextDecoder().decode(resp.stderr).trim()).toBe("error")
  })

  test("supports workdir", async () => {
    const resp = unwrap(await runExec({
      command: "pwd",
      workdir: "/tmp",
      env: {},
      timeoutMs: 0,
    } as any))
    expect(resp.exitCode).toBe(0)
    expect(new TextDecoder().decode(resp.stdout).trim()).toBe("/tmp")
  })

  test("supports env", async () => {
    const resp = unwrap(await runExec({
      command: "echo $MY_VAR",
      workdir: "",
      env: { MY_VAR: "test123" } as any,
      timeoutMs: 0,
    } as any))
    expect(resp.exitCode).toBe(0)
    expect(new TextDecoder().decode(resp.stdout).trim()).toBe("test123")
  })

  test("timeout kills process", async () => {
    const resp = unwrap(await runExec({
      command: "sleep 10",
      workdir: "",
      env: {},
      timeoutMs: 500,
    } as any))
    expect(resp.timedOut).toBe(true)
  })
})

describe("worker spawn", () => {
  test("spawns background job", async () => {
    rmSync(JOBS_DIR, { recursive: true, force: true })
    mkdirSync(JOBS_DIR, { recursive: true })

    const resp = unwrap(await runSpawn({
      jobId: "test-1",
      command: "echo spawned && sleep 0.1",
      workdir: "",
      env: {},
    } as any, JOBS_DIR))
    expect(resp.started).toBe(true)

    await new Promise(r => setTimeout(r, 300))

    expect(existsSync(join(JOBS_DIR, "test-1", "pid"))).toBe(true)
    expect(existsSync(join(JOBS_DIR, "test-1", "exitcode"))).toBe(true)
    expect(readFileSync(join(JOBS_DIR, "test-1", "exitcode"), "utf8").trim()).toBe("0")
    expect(readFileSync(join(JOBS_DIR, "test-1", "stdout"), "utf8").trim()).toBe("spawned")
  })

  test("reports failure for bad command", async () => {
    rmSync(JOBS_DIR, { recursive: true, force: true })
    mkdirSync(JOBS_DIR, { recursive: true })

    const resp = unwrap(await runSpawn({
      jobId: "test-bad",
      command: "exit 42",
      workdir: "",
      env: {},
    } as any, JOBS_DIR))
    expect(resp.started).toBe(true)

    await new Promise(r => setTimeout(r, 200))

    expect(readFileSync(join(JOBS_DIR, "test-bad", "exitcode"), "utf8").trim()).toBe("42")
  })
})
