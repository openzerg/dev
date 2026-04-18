import { ConnectError, Code } from "@connectrpc/connect"
import { now, dbQuery, unwrap } from "./common.js"
import type { DB } from "../db.js"
import type { Workspace } from "@openzerg/common/entities/workspace-schema.js"
import type { PodmanClient } from "../podman/client.js"
import type { ListWorkspacesRequest, DeleteWorkspaceRequest } from "@openzerg/common/gen/registry/v1_pb.js"

function workspaceRowToInfo(ws: Workspace) {
  return {
    workspaceId: ws.id, volumeName: ws.volumeName,
    state: ws.state, boundSessionId: ws.boundSessionId,
    createdAt: ws.createdAt,
  }
}

export function registerWorkspaceHandlers(db: DB, podman: PodmanClient) {
  return {
    listWorkspaces(_req: {}) {
      return unwrap(dbQuery(async () => {
        const rows: Workspace[] = await db.selectFrom("registry_workspaces").selectAll().orderBy("createdAt", "desc").execute()
        return { workspaces: rows.map(workspaceRowToInfo) }
      }))
    },

    deleteWorkspace(req: DeleteWorkspaceRequest) {
      return unwrap(dbQuery(async () => {
        const ws = await db.selectFrom("registry_workspaces").selectAll()
          .where("id", "=", req.workspaceId).executeTakeFirst()
        if (!ws) throw new ConnectError("Workspace not found", Code.NotFound)

        if (ws.boundSessionId) {
          const session = await db.selectFrom("registry_sessions").select(["state"])
            .where("id", "=", ws.boundSessionId).executeTakeFirst()
          if (session && session.state !== "stopped") {
            throw new ConnectError("Cannot delete workspace bound to an active session", Code.FailedPrecondition)
          }
        }

        try { await podman.removeVolume(ws.volumeName) } catch { /* volume may already be gone */ }
        await db.deleteFrom("registry_workspaces").where("id", "=", req.workspaceId).execute()
        return {}
      }))
    },
  }
}
