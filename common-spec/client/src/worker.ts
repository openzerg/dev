import { createClient } from "@connectrpc/connect"
import type { Client } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import { ResultAsync } from "neverthrow"
import { toAppError } from "./errors.js"
import {
  WorkerService,
  ExecRequestSchema,
  SpawnRequestSchema,
  ReadFileRequestSchema,
  WriteFileRequestSchema,
  StatRequestSchema,
  type ExecResponse,
  type SpawnResponse,
  type ReadFileResponse,
  type WriteFileResponse,
  type StatResponse,
} from "../../generated/ts/gen/worker/v1_pb.js"
import { BaseClient, type ClientOptions } from "./common.js"

export class WorkerClient extends BaseClient {
  private readonly client: Client<typeof WorkerService>

  constructor(opts: ClientOptions) {
    super(opts)
    this.client = createClient(WorkerService, this.transport)
  }

  exec(req: {
    command: string
    workdir?: string
    env?: Record<string, string>
    timeoutMs?: number
  }) {
    return ResultAsync.fromPromise(
      this.client.exec(create(ExecRequestSchema, {
        command: req.command,
        workdir: req.workdir ?? "",
        env: req.env ?? {},
        timeoutMs: req.timeoutMs ?? 0,
      })),
      toAppError,
    )
  }

  spawn(req: {
    jobId: string
    command: string
    workdir?: string
    env?: Record<string, string>
  }) {
    return ResultAsync.fromPromise(
      this.client.spawn(create(SpawnRequestSchema, {
        jobId: req.jobId,
        command: req.command,
        workdir: req.workdir ?? "",
        env: req.env ?? {},
      })),
      toAppError,
    )
  }

  readFile(path: string) {
    return ResultAsync.fromPromise(
      this.client.readFile(create(ReadFileRequestSchema, { path })),
      toAppError,
    )
  }

  writeFile(req: { path: string; content: Uint8Array; expectedMtimeMs?: bigint }) {
    return ResultAsync.fromPromise(
      this.client.writeFile(create(WriteFileRequestSchema, {
        path: req.path,
        content: req.content,
        expectedMtimeMs: req.expectedMtimeMs ?? 0n,
      })),
      toAppError,
    )
  }

  stat(path: string) {
    return ResultAsync.fromPromise(
      this.client.stat(create(StatRequestSchema, { path })),
      toAppError,
    )
  }
}
