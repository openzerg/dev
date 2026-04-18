import type { ToolContext } from "./tool.js"
import { RegistryClient, NotFoundError, UpstreamError, type AppError } from "@openzerg/common"
import { ResultAsync } from "neverthrow"

export interface SessionResolverOpts {
  registryUrl: string
  registryToken: string
}

export class SessionResolver {
  private registry: RegistryClient
  private cache = new Map<string, ToolContext>()

  constructor(opts: SessionResolverOpts) {
    this.registry = new RegistryClient({
      baseURL: opts.registryUrl,
      token: opts.registryToken,
    })
  }

  async resolve(sessionToken: string): Promise<ToolContext> {
    const cached = this.cache.get(sessionToken)
    if (cached) return cached

    const result = await this.registry.resolveSession(sessionToken)
    if (result.isErr()) {
      throw result.error
    }
    const resp = result.value
    const serverConfigs: Record<string, Record<string, string>> = {}
    for (const su of resp.zcpServerUrls) {
      if (su.config) {
        try { serverConfigs[su.name] = JSON.parse(su.config) } catch { /* skip */ }
      }
    }
    const ctx: ToolContext = {
      sessionId: resp.sessionId,
      workerUrl: resp.workerUrl,
      workerSecret: resp.workerSecret,
      workspaceRoot: resp.workspaceRoot,
      serverConfigs,
    }
    this.cache.set(sessionToken, ctx)
    return ctx
  }

  invalidate(sessionToken: string): void {
    this.cache.delete(sessionToken)
  }
}
