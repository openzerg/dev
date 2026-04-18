import { createClient } from "@connectrpc/connect"
import type { Client } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import { EmptySchema } from "@bufbuild/protobuf/wkt"
import { ResultAsync } from "neverthrow"
import { toAppError } from "./errors.js"
import {
  AgentService,
  ChatRequestSchema,
  InterruptRequestSchema,
  DeleteMessagesFromRequestSchema,
  SubscribeEventsRequestSchema,
  HealthRequestSchema,
  type ChatResponse,
  type InterruptResponse,
  type DeleteMessagesFromResponse,
  type SessionEvent,
  type HealthResponse,
} from "../../generated/ts/gen/agent/v1_pb.js"
import { BaseClient, type ClientOptions } from "./common.js"
import type { AppError } from "./errors.js"

export class AgentClient extends BaseClient {
  private readonly client: Client<typeof AgentService>

  constructor(opts: ClientOptions) {
    super(opts)
    this.client = createClient(AgentService, this.transport)
  }

  chat(sessionId: string, content: string): ResultAsync<ChatResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.chat(create(ChatRequestSchema, { sessionId, content })),
      toAppError,
    )
  }

  interrupt(sessionId: string): ResultAsync<InterruptResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.interrupt(create(InterruptRequestSchema, { sessionId })),
      toAppError,
    )
  }

  deleteMessagesFrom(sessionId: string, messageId: string): ResultAsync<DeleteMessagesFromResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteMessagesFrom(create(DeleteMessagesFromRequestSchema, { sessionId, messageId })),
      toAppError,
    )
  }

  subscribeSessionEvents(sessionId: string, signal?: AbortSignal): AsyncIterable<SessionEvent> {
    return this.client.subscribeSessionEvents(
      create(SubscribeEventsRequestSchema, { sessionId }),
      { signal },
    )
  }

  health(): ResultAsync<HealthResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.health(create(EmptySchema, {})),
      toAppError,
    )
  }
}
