import type { ConnectRouter } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import {
  ToolService,
  ExecuteToolResponseSchema,
  ListToolsResponseSchema,
  type ExecuteToolRequest,
  type ExecuteToolResponse,
  type ListToolsResponse,
} from "@openzerg/common/gen/tools/v1_pb.js"
import type { ITool, GetContext } from "./tool.js"

export type ToolServiceRouter = (router: ConnectRouter) => void

export interface ToolServerOptions {
  tools: ITool[]
  getContext: GetContext
  systemContext?: string | (() => string | Promise<string>)
}

export function createToolServer(options: ToolServerOptions): ToolServiceRouter
export function createToolServer(tools: ITool[], getContext: GetContext): ToolServiceRouter
export function createToolServer(toolsOrOptions: ITool[] | ToolServerOptions, getContext?: GetContext): ToolServiceRouter {
  const opts: ToolServerOptions = Array.isArray(toolsOrOptions)
    ? { tools: toolsOrOptions, getContext: getContext! }
    : toolsOrOptions

  const toolMap = new Map<string, ITool>()
  for (const tool of opts.tools) {
    toolMap.set(tool.name, tool)
  }

  return (router: ConnectRouter) => {
    router.service(ToolService, {
      async listTools(): Promise<ListToolsResponse> {
        const toolContexts: string[] = []
        for (const t of opts.tools) {
          if (t.systemContext) {
            const ctx = await t.systemContext()
            if (ctx) toolContexts.push(ctx)
          }
        }
        let serverCtx = ""
        if (opts.systemContext) {
          serverCtx = typeof opts.systemContext === "function" ? await opts.systemContext() : opts.systemContext
        }
        const allContexts = [serverCtx, ...toolContexts].filter(Boolean)

        return create(ListToolsResponseSchema, {
          tools: opts.tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchemaJson: JSON.stringify(t.inputSchema),
            outputSchemaJson: JSON.stringify(t.outputSchema),
            group: t.group,
            priority: t.priority,
            dependencies: t.dependencies ?? [],
          })),
          systemContext: allContexts.join("\n\n"),
        })
      },

      async executeTool(req: ExecuteToolRequest): Promise<ExecuteToolResponse> {
        const tool = toolMap.get(req.toolName)
        if (!tool) {
          return create(ExecuteToolResponseSchema, {
            success: false,
            error: `Unknown tool: ${req.toolName}`,
          })
        }

        const result = await tool.execute(req.argsJson, req.sessionToken, opts.getContext)
        if (result.isOk()) {
          return create(ExecuteToolResponseSchema, {
            resultJson: JSON.stringify(result.value),
            success: true,
          })
        }
        return create(ExecuteToolResponseSchema, {
          success: false,
          error: result.error.message,
        })
      },
    })
  }
}
