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
  ListTemplatesRequestSchema,
  GetTemplateRequestSchema,
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  DeleteTemplateRequestSchema,
  ListSessionsRequestSchema,
  GetSessionRequestSchema,
  CreateSessionRequestSchema,
  UpdateSessionMetaRequestSchema,
  UpdateSessionHotConfigRequestSchema,
  UpdateSessionColdConfigRequestSchema,
  SwitchSessionTemplateRequestSchema,
  DeleteSessionRequestSchema,
  StartSessionRequestSchema,
  StopSessionRequestSchema,
  ResolveSessionRequestSchema,
  ListMessagesRequestSchema,
  CreateMessageRequestSchema,
  DeleteMessagesFromRequestSchema,
  type LoginResponse,
  type RegisterResponse,
  type ListInstancesResponse,
  type TemplateInfo,
  type ListTemplatesResponse,
  type ListSessionsResponse,
  type SessionInfo,
  type CreateSessionResponse,
  type ResolveSessionResponse,
  type ListMessagesResponse,
  type CreateMessageResponse,
  type DeleteMessagesFromResponse,
  type DeleteSessionResponse,
  type DeleteTemplateResponse,
  type StartSessionResponse,
  type StopSessionResponse,

  type ProviderConfig,
  type ToolServerEntry,
  type SkillRef,
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

  // ── Template CRUD ─────────────────────────────────────────────────────

  listTemplates(): ResultAsync<ListTemplatesResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listTemplates(create(EmptySchema, {})),
      toAppError,
    )
  }

  getTemplate(templateId: string): ResultAsync<TemplateInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.getTemplate(create(GetTemplateRequestSchema, { templateId })),
      toAppError,
    )
  }

  createTemplate(req: {
    name: string; description?: string; systemPrompt?: string
    providerConfig?: ProviderConfig
    toolServerConfig?: ToolServerEntry[]
    skillConfig?: SkillRef[]
    extraPackage?: string[]
  }): ResultAsync<TemplateInfo, AppError> {
    const defaults = { upstream: "", apiKey: "", modelId: "", maxTokens: 0, contextLength: 0, autoCompactLength: 0 }
    return ResultAsync.fromPromise(
      this.client.createTemplate(create(CreateTemplateRequestSchema, {
        name: req.name,
        description: req.description ?? "",
        systemPrompt: req.systemPrompt ?? "",
        providerConfig: req.providerConfig ?? defaults,
        toolServerConfig: req.toolServerConfig ?? [],
        skillConfig: req.skillConfig ?? [],
        extraPackage: req.extraPackage ?? [],
      })),
      toAppError,
    )
  }

  updateTemplate(req: {
    id: string; name?: string; description?: string; systemPrompt?: string
    providerConfig?: ProviderConfig
    toolServerConfig?: ToolServerEntry[]
    skillConfig?: SkillRef[]
    extraPackage?: string[]
  }): ResultAsync<TemplateInfo, AppError> {
    const defaults = { upstream: "", apiKey: "", modelId: "", maxTokens: 0, contextLength: 0, autoCompactLength: 0 }
    return ResultAsync.fromPromise(
      this.client.updateTemplate(create(UpdateTemplateRequestSchema, {
        id: req.id,
        name: req.name ?? "",
        description: req.description ?? "",
        systemPrompt: req.systemPrompt ?? "",
        providerConfig: req.providerConfig ?? defaults,
        toolServerConfig: req.toolServerConfig ?? [],
        skillConfig: req.skillConfig ?? [],
        extraPackage: req.extraPackage ?? [],
      })),
      toAppError,
    )
  }

  deleteTemplate(templateId: string): ResultAsync<DeleteTemplateResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteTemplate(create(DeleteTemplateRequestSchema, { templateId })),
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
    title: string
    templateId?: string
    systemPrompt?: string
    providerConfig?: ProviderConfig
    toolServerConfig?: ToolServerEntry[]
    skillConfig?: SkillRef[]
    extraPackage?: string[]
    workspaceId?: string
  }): ResultAsync<CreateSessionResponse, AppError> {
    const defaults = { upstream: "", apiKey: "", modelId: "", maxTokens: 0, contextLength: 0, autoCompactLength: 0 }
    return ResultAsync.fromPromise(
      this.client.createSession(create(CreateSessionRequestSchema, {
        title: req.title,
        templateId: req.templateId ?? "",
        systemPrompt: req.systemPrompt ?? "",
        providerConfig: req.providerConfig ?? defaults,
        toolServerConfig: req.toolServerConfig ?? [],
        skillConfig: req.skillConfig ?? [],
        extraPackage: req.extraPackage ?? [],
        workspaceId: req.workspaceId ?? "",
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

  updateSessionHotConfig(req: {
    sessionId: string; systemPrompt?: string
    providerConfig?: ProviderConfig; skillConfig?: SkillRef[]
  }): ResultAsync<SessionInfo, AppError> {
    const defaults = { upstream: "", apiKey: "", modelId: "", maxTokens: 0, contextLength: 0, autoCompactLength: 0 }
    return ResultAsync.fromPromise(
      this.client.updateSessionHotConfig(create(UpdateSessionHotConfigRequestSchema, {
        sessionId: req.sessionId,
        systemPrompt: req.systemPrompt ?? "",
        providerConfig: req.providerConfig ?? defaults,
        skillConfig: req.skillConfig ?? [],
      })),
      toAppError,
    )
  }

  updateSessionColdConfig(req: {
    sessionId: string; toolServerConfig?: ToolServerEntry[]; extraPackage?: string[]
  }): ResultAsync<SessionInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.updateSessionColdConfig(create(UpdateSessionColdConfigRequestSchema, {
        sessionId: req.sessionId,
        toolServerConfig: req.toolServerConfig ?? [],
        extraPackage: req.extraPackage ?? [],
      })),
      toAppError,
    )
  }

  switchSessionTemplate(req: {
    sessionId: string; templateId: string
  }): ResultAsync<SessionInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.switchSessionTemplate(create(SwitchSessionTemplateRequestSchema, {
        sessionId: req.sessionId,
        templateId: req.templateId,
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

}
