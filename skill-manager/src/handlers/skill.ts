import { ConnectError, Code } from "@connectrpc/connect"
import { readFile } from "node:fs/promises"
import { rmSync } from "node:fs"
import { join } from "node:path"
import { randomUUID, now, dbQuery, unwrap } from "./common.js"
import type { DB } from "../db.js"
import type { Skill } from "@openzerg/common/entities/skill-schema.js"
import { parseFrontmatter } from "../frontmatter.js"
import { gitClone, gitPull, gitRevParse } from "../git.js"
import type {
  RegisterSkillRequest,
  UpdateSkillRequest,
  DeleteSkillRequest,
} from "@openzerg/common/gen/skillmanager/v1_pb.js"

function skillRowToInfo(s: Skill) {
  return {
    id: s.id, slug: s.slug, name: s.name, description: s.description,
    gitUrl: s.gitUrl, localPath: s.localPath, commitHash: s.commitHash,
    pkgs: s.pkgs, createdAt: s.createdAt, updatedAt: s.updatedAt,
  }
}

export function registerSkillHandlers(db: DB, skillsDir: string) {
  return {
    registerSkill(req: RegisterSkillRequest) {
      return unwrap(dbQuery(async () => {
        const existing = await db.selectFrom("registry_skills").select(["id"])
          .where("slug", "=", req.slug).executeTakeFirst()
        if (existing) throw new ConnectError(`Skill already exists: ${req.slug}`, Code.AlreadyExists)

        const localPath = join(skillsDir, req.slug)
        await gitClone(req.gitUrl, localPath)

        const mdRaw = await readFile(join(localPath, "SKILL.md"), "utf-8")
        const fm = parseFrontmatter(mdRaw)
        if (!fm) throw new ConnectError("Failed to parse SKILL.md frontmatter", Code.InvalidArgument)

        const commitHash = await gitRevParse(localPath)

        const id = randomUUID()
        const ts = now()
        await db.insertInto("registry_skills").values({
          id, slug: req.slug, name: fm.name, description: fm.description,
          gitUrl: req.gitUrl, localPath, commitHash, pkgs: JSON.stringify(fm.pkgs),
          createdAt: ts, updatedAt: ts,
        }).execute()

        const row = await db.selectFrom("registry_skills").selectAll().where("id", "=", id).executeTakeFirst()
        return { skill: skillRowToInfo(row!) }
      }))
    },

    updateSkill(req: UpdateSkillRequest) {
      return unwrap(dbQuery(async () => {
        const row = await db.selectFrom("registry_skills").selectAll()
          .where("slug", "=", req.slug).executeTakeFirst()
        if (!row) throw new ConnectError(`Skill not found: ${req.slug}`, Code.NotFound)

        await gitPull(row.localPath)

        const mdRaw = await readFile(join(row.localPath, "SKILL.md"), "utf-8")
        const fm = parseFrontmatter(mdRaw)
        if (!fm) throw new ConnectError("Failed to parse SKILL.md frontmatter after pull", Code.Internal)

        const commitHash = await gitRevParse(row.localPath)
        const ts = now()
        await db.updateTable("registry_skills").set({
          name: fm.name, description: fm.description, commitHash,
          pkgs: JSON.stringify(fm.pkgs), updatedAt: ts,
        }).where("id", "=", row.id).execute()

        const updated = await db.selectFrom("registry_skills").selectAll().where("id", "=", row.id).executeTakeFirst()
        return { skill: skillRowToInfo(updated!) }
      }))
    },

    deleteSkill(req: DeleteSkillRequest) {
      return unwrap(dbQuery(async () => {
        const row = await db.selectFrom("registry_skills").selectAll()
          .where("slug", "=", req.slug).executeTakeFirst()
        if (!row) throw new ConnectError(`Skill not found: ${req.slug}`, Code.NotFound)

        rmSync(row.localPath, { recursive: true, force: true })
        await db.deleteFrom("registry_skills").where("id", "=", row.id).execute()
        return {}
      }))
    },

    listSkills() {
      return unwrap(dbQuery(async () => {
        const rows: Skill[] = await db.selectFrom("registry_skills").selectAll().orderBy("slug", "asc").execute()
        return { skills: rows.map(skillRowToInfo) }
      }))
    },

    getSkill(req: { slug: string }) {
      return unwrap(dbQuery(async () => {
        const row = await db.selectFrom("registry_skills").selectAll()
          .where("slug", "=", req.slug).executeTakeFirst()
        if (!row) throw new ConnectError(`Skill not found: ${req.slug}`, Code.NotFound)
        return skillRowToInfo(row)
      }))
    },
  }
}
