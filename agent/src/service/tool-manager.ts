import { ToolRouter } from "@openzerg/common"
import { ToolResolver } from "./tool-resolver.js"
import type { DB } from "../db/index.js"
import type { AppError } from "@openzerg/common"

export class ToolManager {
  private resolvers = new Map<string, ToolRouter>()
  private toolResolver: ToolResolver

  constructor(private db: DB) {
    this.toolResolver = new ToolResolver(db)
  }

  async buildTools(sessionId: string): Promise<void> {
    const serversResult = await this.toolResolver.resolveServers(sessionId)
    const servers = serversResult.isErr() ? [] : serversResult.value
    if (servers.length === 0) {
      this.resolvers.delete(sessionId)
      return
    }

    const tokenResult = await this.toolResolver.getSessionToken(sessionId)
    const token = tokenResult.isErr() ? "" : tokenResult.value

    const router = new ToolRouter()
    router.setSessionToken(token)

    const serverList = servers.map(s => ({
      url: s.url,
      serviceToken: s.name,
    }))
    await router.build(serverList)

    this.resolvers.set(sessionId, router)
  }

  getLLMTools(sessionId: string): Array<{ type: "function"; function: { name: string; description: string; parameters: unknown } }> {
    const router = this.resolvers.get(sessionId)
    if (!router || !router.hasTools()) return []
    return router.getLLMTools()
  }

  getSystemContext(sessionId: string): string {
    const router = this.resolvers.get(sessionId)
    if (!router) return ""
    return router.getSystemContext()
  }

  async executeTool(sessionId: string, toolName: string, argsJson: string): Promise<{ output: string; success: boolean }> {
    const router = this.resolvers.get(sessionId)
    if (!router) {
      return { output: `No tools available for session ${sessionId}`, success: false }
    }
    const result = await router.execute(toolName, argsJson)
    return {
      output: result.resultJson || result.error || "",
      success: result.success,
    }
  }

  hasTools(sessionId: string): boolean {
    return this.resolvers.get(sessionId)?.hasTools() ?? false
  }

  cleanup(sessionId: string): void {
    this.resolvers.delete(sessionId)
  }
}
