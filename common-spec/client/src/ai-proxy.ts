import { createClient } from "@connectrpc/connect"
import type { Client } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import { EmptySchema } from "@bufbuild/protobuf/wkt"
import { ResultAsync } from "neverthrow"
import { toAppError } from "./errors.js"
import {
  AiProxyService,
  ListProxiesRequestSchema,
  GetProxyRequestSchema,
  CreateProxyRequestSchema,
  UpdateProxyRequestSchema,
  DeleteProxyRequestSchema,
  ListProviderModelConfigsRequestSchema,
  GetProviderModelConfigRequestSchema,
  CreateProviderModelConfigRequestSchema,
  UpdateProviderModelConfigRequestSchema,
  DeleteProviderModelConfigRequestSchema,
  ListProviderModelsRequestSchema,
  QueryLogsRequestSchema,
  GetTokenStatsRequestSchema,
  TestProviderModelConfigRequestSchema,
  TestProxyRequestSchema,
  type ListProxiesResponse,
  type ProxyInfo,
  type DeleteProxyResponse,
  type ListProviderModelConfigsResponse,
  type ProviderModelConfigInfo,
  type ListProvidersResponse,
  type ListProviderModelsResponse,
  type QueryLogsResponse,
  type TokenStatsResponse,
  type DeleteProviderModelConfigResponse,
  type TestProviderModelConfigResponse,
  type TestProxyResponse,
} from "../../generated/ts/gen/ai_proxy/v1_pb.js"
import { BaseClient, type ClientOptions } from "./common.js"
import type { AppError } from "./errors.js"

export class AiProxyClient extends BaseClient {
  private readonly client: Client<typeof AiProxyService>

  constructor(opts: ClientOptions) {
    super(opts)
    this.client = createClient(AiProxyService, this.transport)
  }

  listProxies(enabledOnly = false): ResultAsync<ListProxiesResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listProxies(create(ListProxiesRequestSchema, { enabledOnly })),
      toAppError,
    )
  }

  getProxy(id: string): ResultAsync<ProxyInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.getProxy(create(GetProxyRequestSchema, { id })),
      toAppError,
    )
  }

  createProxy(sourceModel: string, providerModelConfigId: string): ResultAsync<ProxyInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.createProxy(create(CreateProxyRequestSchema, { sourceModel, providerModelConfigId })),
      toAppError,
    )
  }

  updateProxy(req: Parameters<typeof create<typeof UpdateProxyRequestSchema>>[1]): ResultAsync<ProxyInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.updateProxy(create(UpdateProxyRequestSchema, req)),
      toAppError,
    )
  }

  deleteProxy(id: string): ResultAsync<DeleteProxyResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteProxy(create(DeleteProxyRequestSchema, { id })),
      toAppError,
    )
  }

  listProviderModelConfigs(enabledOnly = false): ResultAsync<ListProviderModelConfigsResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listProviderModelConfigs(create(ListProviderModelConfigsRequestSchema, { enabledOnly })),
      toAppError,
    )
  }

  getProviderModelConfig(id: string): ResultAsync<ProviderModelConfigInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.getProviderModelConfig(create(GetProviderModelConfigRequestSchema, { id })),
      toAppError,
    )
  }

  createProviderModelConfig(req: Parameters<typeof create<typeof CreateProviderModelConfigRequestSchema>>[1]): ResultAsync<ProviderModelConfigInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.createProviderModelConfig(create(CreateProviderModelConfigRequestSchema, req)),
      toAppError,
    )
  }

  updateProviderModelConfig(req: Parameters<typeof create<typeof UpdateProviderModelConfigRequestSchema>>[1]): ResultAsync<ProviderModelConfigInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.updateProviderModelConfig(create(UpdateProviderModelConfigRequestSchema, req)),
      toAppError,
    )
  }

  deleteProviderModelConfig(id: string): ResultAsync<DeleteProviderModelConfigResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteProviderModelConfig(create(DeleteProviderModelConfigRequestSchema, { id })),
      toAppError,
    )
  }

  listProviders(): ResultAsync<ListProvidersResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listProviders(create(EmptySchema, {})),
      toAppError,
    )
  }

  listProviderModels(providerId: string): ResultAsync<ListProviderModelsResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listProviderModels(create(ListProviderModelsRequestSchema, { providerId })),
      toAppError,
    )
  }

  queryLogs(req: Parameters<typeof create<typeof QueryLogsRequestSchema>>[1]): ResultAsync<QueryLogsResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.queryLogs(create(QueryLogsRequestSchema, req)),
      toAppError,
    )
  }

  getTokenStats(req: Parameters<typeof create<typeof GetTokenStatsRequestSchema>>[1]): ResultAsync<TokenStatsResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.getTokenStats(create(GetTokenStatsRequestSchema, req)),
      toAppError,
    )
  }

  testProviderModelConfig(id: string): ResultAsync<TestProviderModelConfigResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.testProviderModelConfig(create(TestProviderModelConfigRequestSchema, { id })),
      toAppError,
    )
  }

  testProxy(id: string): ResultAsync<TestProxyResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.testProxy(create(TestProxyRequestSchema, { id })),
      toAppError,
    )
  }
}
