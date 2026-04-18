import { ConnectError, Code } from "@connectrpc/connect"
import { randomUUID, now, dbQuery, unwrap } from "./common.js"
import type { DB } from "../db.js"
import type { Role } from "@openzerg/common/entities/role-schema.js"
import type {
  GetRoleRequest, CreateRoleRequest,
  UpdateRoleHotConfigRequest, UpdateRoleWorkspaceConfigRequest,
  DeleteRoleRequest,
} from "@openzerg/common/gen/registry/v1_pb.js"

export function roleRowToInfo(r: Role) {
  return {
    id: r.id, name: r.name, description: r.description,
    systemPrompt: r.systemPrompt, aiProxyId: r.aiProxyId,
    zcpServers: r.zcpServers, skills: r.skills, extraPkgs: r.extraPkgs,
    maxSteps: r.maxSteps, createdAt: r.createdAt, updatedAt: r.updatedAt,
  }
}

export function registerRoleHandlers(db: DB) {
  return {
    listRoles() {
      return unwrap(dbQuery(async () => {
        const rows: Role[] = await db.selectFrom("registry_roles").selectAll().orderBy("name", "asc").execute()
        return { roles: rows.map(roleRowToInfo) }
      }))
    },

    getRole(req: GetRoleRequest) {
      return unwrap(dbQuery(async () => {
        const row = await db.selectFrom("registry_roles").selectAll()
          .where("id", "=", req.roleId).executeTakeFirst()
        if (!row) throw new ConnectError("Role not found", Code.NotFound)
        return roleRowToInfo(row)
      }))
    },

    createRole(req: CreateRoleRequest) {
      return unwrap(dbQuery(async () => {
        const id = randomUUID()
        const ts = now()
        await db.insertInto("registry_roles").values({
          id, name: req.name, description: req.description ?? "",
          systemPrompt: req.systemPrompt ?? "",
          aiProxyId: req.aiProxyId ?? "",
          zcpServers: req.zcpServers ?? "[]",
          skills: req.skills ?? "[]",
          extraPkgs: req.extraPkgs ?? "[]",
          maxSteps: req.maxSteps || 50,
          createdAt: ts, updatedAt: ts,
        }).execute()
        const row = await db.selectFrom("registry_roles").selectAll().where("id", "=", id).executeTakeFirst()
        return roleRowToInfo(row!)
      }))
    },

    updateRoleHotConfig(req: UpdateRoleHotConfigRequest) {
      return unwrap(dbQuery(async () => {
        const ts = now()
        await db.updateTable("registry_roles").set({
          systemPrompt: req.systemPrompt,
          aiProxyId: req.aiProxyId,
          skills: req.skills,
          maxSteps: req.maxSteps || 50,
          updatedAt: ts,
        }).where("id", "=", req.id).execute()
        const row = await db.selectFrom("registry_roles").selectAll().where("id", "=", req.id).executeTakeFirst()
        if (!row) throw new ConnectError("Role not found", Code.NotFound)
        return roleRowToInfo(row)
      }))
    },

    updateRoleWorkspaceConfig(req: UpdateRoleWorkspaceConfigRequest) {
      return unwrap(dbQuery(async () => {
        const ts = now()
        await db.updateTable("registry_roles").set({
          name: req.name,
          description: req.description,
          zcpServers: req.zcpServers,
          extraPkgs: req.extraPkgs,
          updatedAt: ts,
        }).where("id", "=", req.id).execute()
        const row = await db.selectFrom("registry_roles").selectAll().where("id", "=", req.id).executeTakeFirst()
        if (!row) throw new ConnectError("Role not found", Code.NotFound)
        return roleRowToInfo(row)
      }))
    },

    deleteRole(req: DeleteRoleRequest) {
      return unwrap(dbQuery(async () => {
        const active = await db.selectFrom("registry_sessions").select(["id"])
          .where("roleId", "=", req.roleId)
          .where("state", "!=", "stopped")
          .executeTakeFirst()
        if (active) throw new ConnectError("Role has active sessions", Code.FailedPrecondition)
        await db.deleteFrom("registry_roles").where("id", "=", req.roleId).execute()
        return {}
      }))
    },
  }
}
