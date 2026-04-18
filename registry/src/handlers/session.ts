import { ConnectError, Code } from "@connectrpc/connect"
import { randomUUID, now, dbQuery, unwrap } from "./common.js"
import type { DB } from "../db.js"
import type { Session } from "@openzerg/common/entities/session-schema.js"
import type { Workspace } from "@openzerg/common/entities/workspace-schema.js"
import type { Role } from "@openzerg/common/entities/role-schema.js"
import { roleRowToInfo } from "./role.js"
import type { PodmanClient } from "../podman/client.js"
import type {
  ListSessionsRequest, GetSessionRequest, CreateSessionRequest,
  UpdateSessionMetaRequest, SwitchSessionRoleRequest, DeleteSessionRequest,
  StartSessionRequest, StopSessionRequest, ResolveSessionRequest,
} from "@openzerg/common/gen/registry/v1_pb.js"

async function buildSessionInfo(db: DB, s: Session) {
  const role = s.roleId
    ? await db.selectFrom("registry_roles").select(["name"]).where("id", "=", s.roleId).executeTakeFirst()
    : undefined
  const worker = s.workerId
    ? await db.selectFrom("registry_workers").select(["name"]).where("id", "=", s.workerId).executeTakeFirst()
    : undefined
  return {
    sessionId: s.id, title: s.title, roleId: s.roleId,
    roleName: role?.name ?? "", workerId: s.workerId,
    workerName: worker?.name ?? "", agentId: s.agentId,
    sessionToken: s.sessionToken, state: s.state,
    inputTokens: s.inputTokens, outputTokens: s.outputTokens,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
    workspaceId: s.workspaceId,
  }
}

interface ZcpServerEntry {
  type: string
  config?: Record<string, string>
}

function safeParseJson(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return null }
}

function parseZcpServers(zcpServersJson: string): ZcpServerEntry[] {
  const parsed = safeParseJson(zcpServersJson || "[]")
  if (!Array.isArray(parsed)) return []
  return parsed.map((p: unknown) => {
    if (typeof p === "string") return { type: p }
    const obj = p as Record<string, unknown>
    return { type: String(obj.type ?? ""), config: obj.config as Record<string, string> | undefined }
  }).filter((e: ZcpServerEntry) => e.type)
}

async function resolveZcpServerUrls(db: DB, entries: ZcpServerEntry[]) {
  if (entries.length === 0) return []
  const serverTypes = entries.map(e => e.type)
  const instances = await db.selectFrom("registry_instances").selectAll()
    .where("instanceType", "in", serverTypes)
    .where("lifecycle", "=", "active")
    .execute()
  const seen = new Set<string>()
  const configMap = new Map(entries.map(e => [e.type, e.config ?? {}]))
  const result: Array<{ name: string; url: string; config: string }> = []
  for (const inst of instances) {
    if (seen.has(inst.instanceType)) continue
    seen.add(inst.instanceType)
    result.push({
      name: inst.instanceType,
      url: inst.publicUrl,
      config: JSON.stringify(configMap.get(inst.instanceType) ?? {}),
    })
  }
  return result
}

export function registerSessionHandlers(db: DB, podman: PodmanClient, workerImage: string) {
  return {
    listSessions(req: ListSessionsRequest) {
      return unwrap(dbQuery(async () => {
        let query = db.selectFrom("registry_sessions").selectAll()
        if (req.state) query = query.where("state", "=", req.state)
        const sessions: Session[] = await query.orderBy("createdAt", "desc").execute()
        const result = []
        for (const s of sessions) {
          result.push(await buildSessionInfo(db, s))
        }
        return { sessions: result }
      }))
    },

    getSession(req: GetSessionRequest) {
      return unwrap(dbQuery(async () => {
        const s = await db.selectFrom("registry_sessions").selectAll()
          .where("id", "=", req.sessionId).executeTakeFirst()
        if (!s) throw new ConnectError("Session not found", Code.NotFound)
        return buildSessionInfo(db, s)
      }))
    },

    createSession(req: CreateSessionRequest) {
      return unwrap(dbQuery(async () => {
        const role = await db.selectFrom("registry_roles").selectAll()
          .where("id", "=", req.roleId).executeTakeFirst()
        if (!role) throw new ConnectError("Role not found", Code.NotFound)

        const sessionId = randomUUID()
        const token = `stk-${randomUUID()}`
        const ts = now()

        const workspaceId = randomUUID()
        const volumeName = `ws-${workspaceId.slice(0, 12)}`

        await podman.createVolume(volumeName)

        await db.insertInto("registry_workspaces").values({
          id: workspaceId, volumeName, state: "active",
          boundSessionId: sessionId,
          createdAt: ts, updatedAt: ts,
        }).execute()

        await db.insertInto("registry_sessions").values({
          id: sessionId, title: req.title ?? "", roleId: req.roleId,
          workerId: "", agentId: "",
          sessionToken: token, state: "stopped",
          workspaceId, inputTokens: 0n, outputTokens: 0n, lastActiveAt: 0n,
          createdAt: ts, updatedAt: ts,
        }).execute()

        const s = await db.selectFrom("registry_sessions").selectAll()
          .where("id", "=", sessionId).executeTakeFirst()
        return {
          sessionId,
          sessionToken: token,
          session: await buildSessionInfo(db, s!),
        }
      }))
    },

    updateSessionMeta(req: UpdateSessionMetaRequest) {
      return unwrap(dbQuery(async () => {
        const ts = now()
        const updates: Record<string, unknown> = { updatedAt: ts }
        if (req.title) updates.title = req.title
        await db.updateTable("registry_sessions").set(updates)
          .where("id", "=", req.sessionId).execute()
        const s = await db.selectFrom("registry_sessions").selectAll()
          .where("id", "=", req.sessionId).executeTakeFirst()
        if (!s) throw new ConnectError("Session not found", Code.NotFound)
        return buildSessionInfo(db, s)
      }))
    },

    switchSessionRole(req: SwitchSessionRoleRequest) {
      return unwrap(dbQuery(async () => {
        const session = await db.selectFrom("registry_sessions").selectAll()
          .where("id", "=", req.sessionId).executeTakeFirst()
        if (!session) throw new ConnectError("Session not found", Code.NotFound)
        if (session.state !== "stopped") {
          throw new ConnectError("Cannot switch role on a running session. Stop it first.", Code.FailedPrecondition)
        }

        const role = await db.selectFrom("registry_roles").selectAll()
          .where("id", "=", req.roleId).executeTakeFirst()
        if (!role) throw new ConnectError("Role not found", Code.NotFound)

        const ts = now()
        await db.updateTable("registry_sessions").set({
          roleId: req.roleId, updatedAt: ts,
        }).where("id", "=", req.sessionId).execute()

        const s = await db.selectFrom("registry_sessions").selectAll()
          .where("id", "=", req.sessionId).executeTakeFirst()
        return buildSessionInfo(db, s!)
      }))
    },

    deleteSession(req: DeleteSessionRequest) {
      return unwrap(dbQuery(async () => {
        const session = await db.selectFrom("registry_sessions").selectAll()
          .where("id", "=", req.sessionId).executeTakeFirst()
        if (!session) throw new ConnectError("Session not found", Code.NotFound)
        if (session.state !== "stopped") {
          throw new ConnectError("Cannot delete a running session. Stop it first.", Code.FailedPrecondition)
        }

        if (session.workspaceId) {
          const ws = await db.selectFrom("registry_workspaces").selectAll()
            .where("id", "=", session.workspaceId).executeTakeFirst()
          if (ws) {
            try { await podman.removeVolume(ws.volumeName) } catch { /* volume may already be gone */ }
            await db.deleteFrom("registry_workspaces").where("id", "=", ws.id).execute()
          }
        }

        await db.deleteFrom("registry_messages").where("sessionId", "=", req.sessionId).execute()
        await db.deleteFrom("registry_sessions").where("id", "=", req.sessionId).execute()
        return {}
      }))
    },

    startSession(req: StartSessionRequest) {
      return unwrap(dbQuery(async () => {
        const session = await db.selectFrom("registry_sessions").selectAll()
          .where("id", "=", req.sessionId).executeTakeFirst()
        if (!session) throw new ConnectError("Session not found", Code.NotFound)
        if (session.state === "running" || session.state === "creating") {
          throw new ConnectError(`Session already in state: ${session.state}`, Code.FailedPrecondition)
        }

        const ts = now()
        await db.updateTable("registry_sessions").set({
          state: "creating", updatedAt: ts,
        }).where("id", "=", req.sessionId).execute()

        const role = await db.selectFrom("registry_roles").selectAll()
          .where("id", "=", session.roleId).executeTakeFirst()

        const workspace = session.workspaceId
          ? await db.selectFrom("registry_workspaces").selectAll().where("id", "=", session.workspaceId).executeTakeFirst()
          : undefined

        const workerId = randomUUID()
        const containerName = `worker-${workerId.slice(0, 12)}`
        const secret = randomUUID()

        const zcpEntries = role ? parseZcpServers(role.zcpServers) : []
        const zcpServers = await resolveZcpServerUrls(db, zcpEntries)
        const nixPkgs = role ? role.extraPkgs : "[]"

        try {
          await podman.createContainer({
            name: containerName,
            image: workerImage,
            env: {
              REGISTRY_URL: process.env.REGISTRY_INTERNAL_URL ?? "http://registry:25000",
              WORKER_ID: workerId,
              WORKER_SECRET: secret,
              SESSION_TOKEN: session.sessionToken,
              NIX_PKGS: nixPkgs,
            },
            volumes: workspace
              ? [{ name: workspace.volumeName, destination: "/data/workspace" }]
              : [],
          })
          await podman.startContainer(containerName)
        } catch (err) {
          await db.updateTable("registry_sessions").set({
            state: "stopped", updatedAt: now(),
          }).where("id", "=", req.sessionId).execute()
          throw new ConnectError(`Failed to start worker: ${err}`, Code.Internal)
        }

        const ts2 = now()
        await db.updateTable("registry_sessions").set({
          state: "idle", workerId, lastActiveAt: ts2, updatedAt: ts2,
        }).where("id", "=", req.sessionId).execute()

        if (workspace) {
          await db.updateTable("registry_workspaces").set({
            state: "active", updatedAt: ts2,
          }).where("id", "=", workspace.id).execute()
        }

        return {}
      }))
    },

    stopSession(req: StopSessionRequest) {
      return unwrap(dbQuery(async () => {
        const session = await db.selectFrom("registry_sessions").selectAll()
          .where("id", "=", req.sessionId).executeTakeFirst()
        if (!session) throw new ConnectError("Session not found", Code.NotFound)
        if (session.state === "stopped") return {}

        if (session.workerId) {
          const worker = await db.selectFrom("registry_workers").selectAll()
            .where("id", "=", session.workerId).executeTakeFirst()
          if (worker) {
            try { await podman.stopContainer(worker.containerName) } catch { /* may already be stopped */ }
            try { await podman.removeContainer(worker.containerName) } catch { /* may already be removed */ }
          }
        }

        const ts = now()
        await db.updateTable("registry_sessions").set({
          state: "stopped", workerId: "", updatedAt: ts,
        }).where("id", "=", req.sessionId).execute()

        if (session.workspaceId) {
          await db.updateTable("registry_workspaces").set({
            state: "stopped", updatedAt: ts,
          }).where("id", "=", session.workspaceId).execute()
        }

        return {}
      }))
    },

    resolveSession(req: ResolveSessionRequest) {
      return unwrap(dbQuery(async () => {
        const session = await db.selectFrom("registry_sessions").selectAll()
          .where("sessionToken", "=", req.sessionToken).executeTakeFirst()
        if (!session) throw new ConnectError("Session not found", Code.NotFound)

        const role: Role | undefined = session.roleId
          ? await db.selectFrom("registry_roles").selectAll().where("id", "=", session.roleId).executeTakeFirst()
          : undefined

        let workerUrl = ""
        let workerSecret = ""
        let workspaceRoot = ""
        if (session.workerId) {
          const worker = await db.selectFrom("registry_workers").selectAll()
            .where("id", "=", session.workerId).executeTakeFirst()
          if (worker) {
            workerUrl = worker.containerName.startsWith("http") ? worker.containerName : `http://${worker.containerName}`
            workerSecret = worker.secret
            workspaceRoot = worker.workspaceRoot
          }
        }

        const serverEntries = role ? parseZcpServers(role.zcpServers) : []
        const zcpServerUrls = await resolveZcpServerUrls(db, serverEntries)

        return {
          sessionId: session.id,
          roleId: session.roleId,
          roleInfo: role ? roleRowToInfo(role) : {
            id: "", name: "", description: "", systemPrompt: "",
            aiProxyId: "", zcpServers: "[]", skills: "[]", extraPkgs: "[]", maxSteps: 50,
            createdAt: 0n, updatedAt: 0n,
          },
          workerId: session.workerId,
          workerUrl, workerSecret, workspaceRoot,
          agentUrl: session.agentId,
          zcpServerUrls,
          workspaceId: session.workspaceId,
        }
      }))
    },
  }
}
