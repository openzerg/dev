import { createClient } from "@connectrpc/connect"
import type { Client } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import { EmptySchema } from "@bufbuild/protobuf/wkt"
import { ResultAsync } from "neverthrow"
import { toAppError } from "./errors.js"
import {
  RegistryService,
  LoginRequestSchema,
  RegisterRequestSchema,
  HeartbeatRequestSchema,
  ListInstancesRequestSchema,
  ListRolesRequestSchema,
  GetRoleRequestSchema,
  CreateRoleRequestSchema,
  UpdateRoleHotConfigRequestSchema,
  UpdateRoleWorkspaceConfigRequestSchema,
  DeleteRoleRequestSchema,
  ListSessionsRequestSchema,
  GetSessionRequestSchema,
  CreateSessionRequestSchema,
  UpdateSessionMetaRequestSchema,
  SwitchSessionRoleRequestSchema,
  DeleteSessionRequestSchema,
  StartSessionRequestSchema,
  StopSessionRequestSchema,
  ResolveSessionRequestSchema,
  ListMessagesRequestSchema,
  CreateMessageRequestSchema,
  DeleteMessagesFromRequestSchema,
  ListWorkspacesRequestSchema,
  DeleteWorkspaceRequestSchema,
  type LoginResponse,
  type RegisterResponse,
  type ListInstancesResponse,
  type RoleInfo,
  type ListRolesResponse,
  type ListSessionsResponse,
  type SessionInfo,
  type CreateSessionResponse,
  type ResolveSessionResponse,
  type ListMessagesResponse,
  type CreateMessageResponse,
  type DeleteMessagesFromResponse,
  type DeleteSessionResponse,
  type DeleteRoleResponse,
  type StartSessionResponse,
  type StopSessionResponse,
  type ListWorkspacesResponse,
  type DeleteWorkspaceResponse,
} from "../../generated/ts/gen/registry/v1_pb.js"
import { BaseClient, type ClientOptions } from "./common.js"
import type { AppError } from "./errors.js"

export class RegistryClient extends BaseClient {
  private readonly client: Client<typeof RegistryService>

  constructor(opts: ClientOptions) {
    super(opts)
    this.client = createClient(RegistryService, this.transport)
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  login(apiKey: string): ResultAsync<LoginResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.login(create(LoginRequestSchema, { apiKey })),
      toAppError,
    )
  }

  // ── Service Registration ──────────────────────────────────────────────

  register(req: {
    name: string; instanceType: string; ip: string; port: number
    publicUrl: string; metadata?: Record<string, string>
  }): ResultAsync<RegisterResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.register(create(RegisterRequestSchema, req)),
      toAppError,
    )
  }

  heartbeat(instanceId: string): ResultAsync<void, AppError> {
    return ResultAsync.fromPromise(
      this.client.heartbeat(create(HeartbeatRequestSchema, { instanceId })).then(() => {}),
      toAppError,
    )
  }

  listInstances(instanceType: string): ResultAsync<ListInstancesResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listInstances(create(ListInstancesRequestSchema, { instanceType })),
      toAppError,
    )
  }

  // ── Role CRUD ─────────────────────────────────────────────────────────

  listRoles(): ResultAsync<ListRolesResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listRoles(create(EmptySchema, {})),
      toAppError,
    )
  }

  getRole(roleId: string): ResultAsync<RoleInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.getRole(create(GetRoleRequestSchema, { roleId })),
      toAppError,
    )
  }

  createRole(req: {
    name: string; description?: string; systemPrompt?: string
    aiProxyId?: string; zcpServers?: string; skills?: string
    extraPkgs?: string; maxSteps?: number
  }): ResultAsync<RoleInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.createRole(create(CreateRoleRequestSchema, {
        name: req.name,
        description: req.description ?? "",
        systemPrompt: req.systemPrompt ?? "",
        aiProxyId: req.aiProxyId ?? "",
        zcpServers: req.zcpServers ?? "",
        skills: req.skills ?? "",
        extraPkgs: req.extraPkgs ?? "",
        maxSteps: req.maxSteps ?? 0,
      })),
      toAppError,
    )
  }

  updateRoleHotConfig(req: {
    id: string; systemPrompt?: string; aiProxyId?: string
    skills?: string; maxSteps?: number
  }): ResultAsync<RoleInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.updateRoleHotConfig(create(UpdateRoleHotConfigRequestSchema, {
        id: req.id,
        systemPrompt: req.systemPrompt ?? "",
        aiProxyId: req.aiProxyId ?? "",
        skills: req.skills ?? "",
        maxSteps: req.maxSteps ?? 0,
      })),
      toAppError,
    )
  }

  updateRoleWorkspaceConfig(req: {
    id: string; name?: string; description?: string
    zcpServers?: string; extraPkgs?: string
  }): ResultAsync<RoleInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.updateRoleWorkspaceConfig(create(UpdateRoleWorkspaceConfigRequestSchema, {
        id: req.id,
        name: req.name ?? "",
        description: req.description ?? "",
        zcpServers: req.zcpServers ?? "",
        extraPkgs: req.extraPkgs ?? "",
      })),
      toAppError,
    )
  }

  deleteRole(roleId: string): ResultAsync<DeleteRoleResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteRole(create(DeleteRoleRequestSchema, { roleId })),
      toAppError,
    )
  }

  // ── Session CRUD + Lifecycle ──────────────────────────────────────────

  listSessions(state?: string): ResultAsync<ListSessionsResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listSessions(create(ListSessionsRequestSchema, { state: state ?? "" })),
      toAppError,
    )
  }

  getSession(sessionId: string): ResultAsync<SessionInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.getSession(create(GetSessionRequestSchema, { sessionId })),
      toAppError,
    )
  }

  createSession(req: {
    title: string; roleId: string
  }): ResultAsync<CreateSessionResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.createSession(create(CreateSessionRequestSchema, {
        title: req.title,
        roleId: req.roleId,
      })),
      toAppError,
    )
  }

  updateSessionMeta(req: {
    sessionId: string; title?: string
  }): ResultAsync<SessionInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.updateSessionMeta(create(UpdateSessionMetaRequestSchema, {
        sessionId: req.sessionId,
        title: req.title ?? "",
      })),
      toAppError,
    )
  }

  switchSessionRole(req: {
    sessionId: string; roleId: string
  }): ResultAsync<SessionInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.switchSessionRole(create(SwitchSessionRoleRequestSchema, {
        sessionId: req.sessionId,
        roleId: req.roleId,
      })),
      toAppError,
    )
  }

  deleteSession(sessionId: string): ResultAsync<DeleteSessionResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteSession(create(DeleteSessionRequestSchema, { sessionId })),
      toAppError,
    )
  }

  startSession(sessionId: string): ResultAsync<StartSessionResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.startSession(create(StartSessionRequestSchema, { sessionId })),
      toAppError,
    )
  }

  stopSession(sessionId: string): ResultAsync<StopSessionResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.stopSession(create(StopSessionRequestSchema, { sessionId })),
      toAppError,
    )
  }

  resolveSession(sessionToken: string): ResultAsync<ResolveSessionResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.resolveSession(create(ResolveSessionRequestSchema, { sessionToken })),
      toAppError,
    )
  }

  // ── Message CRUD ──────────────────────────────────────────────────────

  listMessages(req: {
    sessionId: string; limit?: number; beforeId?: string
  }): ResultAsync<ListMessagesResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listMessages(create(ListMessagesRequestSchema, {
        sessionId: req.sessionId,
        limit: req.limit ?? 100,
        beforeId: req.beforeId ?? "",
      })),
      toAppError,
    )
  }

  createMessage(req: {
    sessionId: string; role: string; parentMessageId?: string
    toolCallId?: string; toolName?: string; content?: string
    tokenUsage?: string; metadata?: string
  }): ResultAsync<CreateMessageResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.createMessage(create(CreateMessageRequestSchema, {
        sessionId: req.sessionId, role: req.role,
        parentMessageId: req.parentMessageId ?? "",
        toolCallId: req.toolCallId ?? "",
        toolName: req.toolName ?? "",
        content: req.content ?? "",
        tokenUsage: req.tokenUsage ?? "{}",
        metadata: req.metadata ?? "{}",
      })),
      toAppError,
    )
  }

  deleteMessagesFrom(sessionId: string, messageId: string): ResultAsync<DeleteMessagesFromResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteMessagesFrom(create(DeleteMessagesFromRequestSchema, { sessionId, messageId })),
      toAppError,
    )
  }

  // ── Workspace Management ────────────────────────────────────────────────

  listWorkspaces(): ResultAsync<ListWorkspacesResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listWorkspaces({}),
      toAppError,
    )
  }

  deleteWorkspace(workspaceId: string): ResultAsync<DeleteWorkspaceResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteWorkspace(create(DeleteWorkspaceRequestSchema, { workspaceId })),
      toAppError,
    )
  }
}
