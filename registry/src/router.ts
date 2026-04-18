import type { ConnectRouter } from "@connectrpc/connect"
import { RegistryService } from "@openzerg/common/gen/registry/v1_pb.js"
import type { DB } from "./db.js"
import type { PodmanClient } from "./podman/client.js"
import { registerAuthHandlers } from "./handlers/auth.js"
import { registerRegistryHandlers } from "./handlers/registry.js"
import { registerRoleHandlers } from "./handlers/role.js"
import { registerSessionHandlers } from "./handlers/session.js"
import { registerMessageHandlers } from "./handlers/message.js"
import { registerWorkerHandlers } from "./handlers/worker.js"
import { registerWorkspaceHandlers } from "./handlers/workspace.js"

export function createRegistryRouter(db: DB, podman: PodmanClient, workerImage: string): (router: ConnectRouter) => void {
  return (router: ConnectRouter) => {
    const auth = registerAuthHandlers()
    const registry = registerRegistryHandlers(db)
    const role = registerRoleHandlers(db)
    const session = registerSessionHandlers(db, podman, workerImage)
    const message = registerMessageHandlers(db)
    const worker = registerWorkerHandlers()
    const workspace = registerWorkspaceHandlers(db, podman)

    router.service(RegistryService, {
      ...auth,
      ...registry,
      ...role,
      ...session,
      ...message,
      ...worker,
      ...workspace,
    })
  }
}
