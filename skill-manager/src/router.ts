import type { ConnectRouter } from "@connectrpc/connect"
import { SkillManagerService } from "@openzerg/common/gen/skillmanager/v1_pb.js"
import type { DB } from "./db.js"
import { registerSkillHandlers } from "./handlers/skill.js"

export function createSkillManagerRouter(db: DB, skillsDir: string): (router: ConnectRouter) => void {
  return (router: ConnectRouter) => {
    const skill = registerSkillHandlers(db, skillsDir)
    router.service(SkillManagerService, { ...skill })
  }
}
