import { createClient } from "@connectrpc/connect"
import type { Client } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import { EmptySchema } from "@bufbuild/protobuf/wkt"
import { ResultAsync } from "neverthrow"
import { toAppError, type AppError } from "./errors.js"
import {
  ToolService,
  ListToolsRequestSchema,
  ExecuteToolRequestSchema,
  ExecuteToolResponseSchema,
  type ListToolsResponse,
  type ExecuteToolResponse,
} from "../../generated/ts/gen/tools/v1_pb.js"
import { BaseClient, type ClientOptions } from "./common.js"

export class ToolServiceClient extends BaseClient {
  private readonly client: Client<typeof ToolService>

  constructor(opts: ClientOptions) {
    super(opts)
    this.client = createClient(ToolService, this.transport)
  }

  listTools(): ResultAsync<ListToolsResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listTools(create(EmptySchema, {})),
      toAppError,
    )
  }

  executeTool(toolName: string, argsJson: string, sessionToken: string): ResultAsync<ExecuteToolResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.executeTool(create(ExecuteToolRequestSchema, { toolName, argsJson, sessionToken })),
      toAppError,
    )
  }
}

export class ToolRouter {
  private routes = new Map<string, { client: ToolServiceClient; def: { name: string; description: string; inputSchemaJson: string; priority: number } }>()
  private sessionToken: string = ""
  private systemContexts: string[] = []

  setSessionToken(token: string): void {
    this.sessionToken = token
  }

  async build(servers: Array<{ url: string; serviceToken: string }>): Promise<void> {
    this.routes.clear()
    this.systemContexts = []
    for (const server of servers) {
      const client = new ToolServiceClient({ baseURL: server.url, token: server.serviceToken })
      const result = await client.listTools()
      if (result.isErr()) {
        console.warn(`[ToolRouter] Failed to list tools from ${server.url}:`, result.error)
        continue
      }
      if (result.value.systemContext) {
        this.systemContexts.push(result.value.systemContext)
      }
      for (const tool of result.value.tools) {
        const existing = this.routes.get(tool.name)
        if (!existing || tool.priority > existing.def.priority) {
          this.routes.set(tool.name, { client, def: tool })
        }
      }
    }
  }

  getSystemContext(): string {
    return this.systemContexts.filter(Boolean).join("\n\n")
  }

  async execute(toolName: string, argsJson: string): Promise<ExecuteToolResponse> {
    const route = this.routes.get(toolName)
    if (!route) {
      return create(ExecuteToolResponseSchema, { resultJson: "", success: false, error: `Unknown tool: ${toolName}` })
    }
    const result = await route.client.executeTool(toolName, argsJson, this.sessionToken)
    if (result.isErr()) {
      return create(ExecuteToolResponseSchema, { resultJson: "", success: false, error: result.error.message })
    }
    return result.value
  }

  getLLMTools(): Array<{ type: "function"; function: { name: string; description: string; parameters: unknown } }> {
    return [...this.routes.values()].map(({ def }) => ({
      type: "function" as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: JSON.parse(def.inputSchemaJson),
      },
    }))
  }

  listTools() {
    return [...this.routes.values()].map(({ def }) => def)
  }

  hasTools(): boolean {
    return this.routes.size > 0
  }
}
