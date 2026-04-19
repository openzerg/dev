import { createClient } from "@connectrpc/connect"
import type { Client } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import { EmptySchema } from "@bufbuild/protobuf/wkt"
import { ResultAsync } from "neverthrow"
import { toAppError } from "./errors.js"
import {
  ToolServerManagerService,
  StartToolServerRequestSchema,
  StopToolServerRequestSchema,
  ResolveToolsRequestSchema,
  ExecuteToolRequestSchema,
  RefreshToolCacheRequestSchema,
  type HealthResponse,
  type StartToolServerResponse,
  type StopToolServerResponse,
  type ListToolServersResponse,
  type ResolveToolsResponse,
  type ExecuteToolResponse,
  type RefreshToolCacheResponse,
} from "../../generated/ts/gen/toolservermanager/v1_pb.js"
import { BaseClient, type ClientOptions } from "./common.js"
import type { AppError } from "./errors.js"

export interface IToolServerManager {
  health(): ResultAsync<HealthResponse, AppError>
  startToolServer(req: {
    type: string; image: string; env?: Record<string, string>; command?: string[]
  }): ResultAsync<StartToolServerResponse, AppError>
  stopToolServer(type: string): ResultAsync<StopToolServerResponse, AppError>
  listToolServers(): ResultAsync<ListToolServersResponse, AppError>
  refreshToolCache(instanceType: string): ResultAsync<RefreshToolCacheResponse, AppError>
  resolveTools(sessionId: string, toolServerTypes: string[]): ResultAsync<ResolveToolsResponse, AppError>
  executeTool(req: {
    sessionId: string; toolName: string; argsJson: string; sessionToken: string
  }): ResultAsync<ExecuteToolResponse, AppError>
}

export class ToolServerManagerClient extends BaseClient implements IToolServerManager {
  private client: Client<typeof ToolServerManagerService>

  constructor(opts: ClientOptions) {
    super(opts)
    this.client = createClient(ToolServerManagerService, this.transport)
  }

  health(): ResultAsync<HealthResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.health(create(EmptySchema, {})),
      toAppError,
    )
  }

  startToolServer(req: {
    type: string; image: string; env?: Record<string, string>; command?: string[]
  }): ResultAsync<StartToolServerResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.startToolServer(create(StartToolServerRequestSchema, {
        type: req.type,
        image: req.image,
        env: Object.entries(req.env ?? {}).map(([key, value]) => ({ key, value })),
        command: req.command ?? [],
      })),
      toAppError,
    )
  }

  stopToolServer(type: string): ResultAsync<StopToolServerResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.stopToolServer(create(StopToolServerRequestSchema, { type })),
      toAppError,
    )
  }

  listToolServers(): ResultAsync<ListToolServersResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listToolServers(create(EmptySchema, {})),
      toAppError,
    )
  }

  refreshToolCache(instanceType: string): ResultAsync<RefreshToolCacheResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.refreshToolCache(create(RefreshToolCacheRequestSchema, { instanceType })),
      toAppError,
    )
  }

  resolveTools(sessionId: string, toolServerTypes: string[]): ResultAsync<ResolveToolsResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.resolveTools(create(ResolveToolsRequestSchema, {
        sessionId, toolServerTypes,
      })),
      toAppError,
    )
  }

  executeTool(req: {
    sessionId: string; toolName: string; argsJson: string; sessionToken: string
  }): ResultAsync<ExecuteToolResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.executeTool(create(ExecuteToolRequestSchema, {
        sessionId: req.sessionId, toolName: req.toolName,
        argsJson: req.argsJson, sessionToken: req.sessionToken,
      })),
      toAppError,
    )
  }
}
