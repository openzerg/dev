import { describe, test, beforeAll, afterAll, expect } from "bun:test"
import { createServer } from "node:http"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { SkillManagerClient } from "@openzerg/common"
import { openDB, autoMigrate } from "../src/db.js"
import { createSkillManagerRouter } from "../src/router.js"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { execSync } from "node:child_process"

const PG_PORT = 15440
const PG_URL = `postgres://e2e:e2e@127.0.0.1:${PG_PORT}/e2e_skill_mgr`
const SERVICE_PORT = 25086
const SKILLS_DIR = "/tmp/e2e-skills-test"

let client: SkillManagerClient
let server: ReturnType<typeof createServer>
let db: Awaited<ReturnType<typeof openDB>>

beforeAll(async () => {
  try { execSync(`podman rm -f e2e-skill-mgr-pg`, { stdio: "pipe" }) } catch {}
  execSync(
    `podman run -d --name e2e-skill-mgr-pg -p ${PG_PORT}:5432 ` +
    `-e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=e2e_skill_mgr ` +
    `docker.io/library/postgres:17-alpine`,
    { stdio: "pipe" },
  )
  let migrated = false
  for (let i = 0; i < 15; i++) {
    try { await autoMigrate(PG_URL); migrated = true; break } catch { await new Promise(r => setTimeout(r, 1000)) }
  }
  if (!migrated) throw new Error("autoMigrate failed")

  db = openDB(PG_URL)
  await mkdir(SKILLS_DIR, { recursive: true })
  const handler = connectNodeAdapter({ routes: createSkillManagerRouter(db, SKILLS_DIR) })
  server = createServer(handler)
  await new Promise<void>(r => server.listen(SERVICE_PORT, () => r()))
  client = new SkillManagerClient({ baseURL: `http://localhost:${SERVICE_PORT}` })
}, 30_000)

afterAll(async () => {
  server?.close()
  db?.destroy()
  try { execSync(`podman rm -f e2e-skill-mgr-pg`, { stdio: "pipe" }) } catch {}
  try { execSync(`rm -rf ${SKILLS_DIR}`, { stdio: "pipe" }) } catch {}
}, 15_000)

describe("Skill Manager E2E", () => {
  test("listSkills returns empty initially", async () => {
    const result = await client.listSkills()
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.skills.length).toBe(0)
  })

  test("registerSkill with a local git repo", async () => {
    const slug = "test-skill"
    const srcDir = join(SKILLS_DIR, "_src", slug)
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, "SKILL.md"), `---
name: Test Skill
description: A skill for testing
pkgs:
  - ripgrep
---
# Test Skill Content
`)
    execSync(`git init`, { cwd: srcDir, stdio: "pipe" })
    execSync(`git add -A && git commit -m "init"`, { cwd: srcDir, stdio: "pipe" })
    const gitUrl = srcDir

    const result = await client.registerSkill({ slug, gitUrl })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.skill.slug).toBe(slug)
    expect(result.value.skill.name).toBe("Test Skill")
    expect(result.value.skill.description).toBe("A skill for testing")

    const listed = await client.listSkills()
    expect(listed.isOk()).toBe(true)
    if (!listed.isOk()) return
    expect(listed.value.skills.length).toBe(1)

    const got = await client.getSkill(slug)
    expect(got.isOk()).toBe(true)
    if (!got.isOk()) return
    expect(got.value.name).toBe("Test Skill")
  })

  test("registerSkill duplicate slug fails", async () => {
    const slug = "test-skill"
    const srcDir = join(SKILLS_DIR, "_src", slug)
    const gitUrl = srcDir
    const result = await client.registerSkill({ slug, gitUrl })
    expect(result.isErr()).toBe(true)
  })

  test("deleteSkill removes skill", async () => {
    const result = await client.deleteSkill("test-skill")
    expect(result.isOk()).toBe(true)

    const listed = await client.listSkills()
    expect(listed.isOk()).toBe(true)
    if (!listed.isOk()) return
    expect(listed.value.skills.length).toBe(0)
  })

  test("getSkill not found", async () => {
    const result = await client.getSkill("nonexistent")
    expect(result.isErr()).toBe(true)
  })

  test("deleteSkill not found", async () => {
    const result = await client.deleteSkill("nonexistent")
    expect(result.isErr()).toBe(true)
  })
})
