import { createClient } from "@connectrpc/connect"
import type { Client } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import { EmptySchema } from "@bufbuild/protobuf/wkt"
import { ResultAsync } from "neverthrow"
import { toAppError } from "./errors.js"
import {
  WorkspaceManagerService,
  CreateWorkspaceRequestSchema,
  GetWorkspaceRequestSchema,
  DeleteWorkspaceRequestSchema,
  StartWorkerRequestSchema,
  StopWorkerRequestSchema,
  GetWorkerStatusRequestSchema,
  EnsureWorkspaceWorkerRequestSchema,
  UpdateWorkspaceConfigRequestSchema,
  type HealthResponse,
  type CreateWorkspaceResponse,
  type ListWorkspacesResponse,
  type WmWorkspaceInfo,
  type DeleteWorkspaceResponse,
  type StartWorkerResponse,
  type StopWorkerResponse,
  type GetWorkerStatusResponse,
  type ListWorkersResponse,
  type EnsureWorkspaceWorkerResponse,
  type UpdateWorkspaceConfigResponse,
} from "../../generated/ts/gen/workspacemanager/v1_pb.js"
import { BaseClient, type ClientOptions } from "./common.js"
import type { AppError } from "./errors.js"

export interface IWorkspaceManager {
  health(): ResultAsync<HealthResponse, AppError>
  createWorkspace(sessionId: string): ResultAsync<CreateWorkspaceResponse, AppError>
  listWorkspaces(): ResultAsync<ListWorkspacesResponse, AppError>
  getWorkspace(workspaceId: string): ResultAsync<WmWorkspaceInfo, AppError>
  deleteWorkspace(workspaceId: string): ResultAsync<DeleteWorkspaceResponse, AppError>
  startWorker(req: {
    sessionId: string
    image: string
    env: Record<string, string>
    volumes: Array<{ name: string; destination: string }>
    command?: string[]
  }): ResultAsync<StartWorkerResponse, AppError>
  stopWorker(workerId: string): ResultAsync<StopWorkerResponse, AppError>
  getWorkerStatus(workerId: string): ResultAsync<GetWorkerStatusResponse, AppError>
  listWorkers(): ResultAsync<ListWorkersResponse, AppError>
  ensureWorkspaceWorker(req: {
    workspaceId: string
    image: string
    env?: Record<string, string>
  }): ResultAsync<EnsureWorkspaceWorkerResponse, AppError>
  updateWorkspaceConfig(req: {
    workspaceId: string
    skillSlugs: string
    nixPkgs: string
  }): ResultAsync<UpdateWorkspaceConfigResponse, AppError>
}

export class WorkspaceManagerClient extends BaseClient implements IWorkspaceManager {
  private client: Client<typeof WorkspaceManagerService>

  constructor(opts: ClientOptions) {
    super(opts)
    this.client = createClient(WorkspaceManagerService, this.transport)
  }

  health(): ResultAsync<HealthResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.health(create(EmptySchema, {})),
      toAppError,
    )
  }

  createWorkspace(sessionId: string): ResultAsync<CreateWorkspaceResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.createWorkspace(create(CreateWorkspaceRequestSchema, { sessionId })),
      toAppError,
    )
  }

  listWorkspaces(): ResultAsync<ListWorkspacesResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listWorkspaces(create(EmptySchema, {})),
      toAppError,
    )
  }

  getWorkspace(workspaceId: string): ResultAsync<WmWorkspaceInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.getWorkspace(create(GetWorkspaceRequestSchema, { workspaceId })),
      toAppError,
    )
  }

  deleteWorkspace(workspaceId: string): ResultAsync<DeleteWorkspaceResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteWorkspace(create(DeleteWorkspaceRequestSchema, { workspaceId })),
      toAppError,
    )
  }

  startWorker(req: {
    sessionId: string
    image: string
    env: Record<string, string>
    volumes: Array<{ name: string; destination: string }>
    command?: string[]
  }): ResultAsync<StartWorkerResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.startWorker(create(StartWorkerRequestSchema, {
        sessionId: req.sessionId,
        image: req.image,
        env: req.env,
        volumes: req.volumes.map(v => ({ name: v.name, destination: v.destination })),
        command: req.command ?? [],
      })),
      toAppError,
    )
  }

  stopWorker(workerId: string): ResultAsync<StopWorkerResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.stopWorker(create(StopWorkerRequestSchema, { workerId })),
      toAppError,
    )
  }

  getWorkerStatus(workerId: string): ResultAsync<GetWorkerStatusResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.getWorkerStatus(create(GetWorkerStatusRequestSchema, { workerId })),
      toAppError,
    )
  }

  listWorkers(): ResultAsync<ListWorkersResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listWorkers(create(EmptySchema, {})),
      toAppError,
    )
  }

  ensureWorkspaceWorker(req: {
    workspaceId: string
    image: string
    env?: Record<string, string>
  }): ResultAsync<EnsureWorkspaceWorkerResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.ensureWorkspaceWorker(create(EnsureWorkspaceWorkerRequestSchema, {
        workspaceId: req.workspaceId,
        image: req.image,
        env: req.env ?? {},
      })),
      toAppError,
    )
  }

  updateWorkspaceConfig(req: {
    workspaceId: string
    skillSlugs: string
    nixPkgs: string
  }): ResultAsync<UpdateWorkspaceConfigResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.updateWorkspaceConfig(create(UpdateWorkspaceConfigRequestSchema, {
        workspaceId: req.workspaceId,
        skillSlugs: req.skillSlugs,
        nixPkgs: req.nixPkgs,
      })),
      toAppError,
    )
  }
}
