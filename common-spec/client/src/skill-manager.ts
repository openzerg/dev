import { createClient } from "@connectrpc/connect"
import type { Client } from "@connectrpc/connect"
import { create } from "@bufbuild/protobuf"
import { ResultAsync } from "neverthrow"
import { toAppError } from "./errors.js"
import {
  SkillManagerService,
  RegisterSkillRequestSchema,
  UpdateSkillRequestSchema,
  DeleteSkillRequestSchema,
  GetSkillRequestSchema,
  type RegisterSkillResponse,
  type UpdateSkillResponse,
  type DeleteSkillResponse,
  type ListSkillsResponse,
  type SkillInfo,
} from "../../generated/ts/gen/skillmanager/v1_pb.js"
import { BaseClient, type ClientOptions } from "./common.js"
import type { AppError } from "./errors.js"

export class SkillManagerClient extends BaseClient {
  private readonly client: Client<typeof SkillManagerService>

  constructor(opts: ClientOptions) {
    super(opts)
    this.client = createClient(SkillManagerService, this.transport)
  }

  registerSkill(req: { slug: string; gitUrl: string }): ResultAsync<RegisterSkillResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.registerSkill(create(RegisterSkillRequestSchema, req)),
      toAppError,
    )
  }

  updateSkill(slug: string): ResultAsync<UpdateSkillResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.updateSkill(create(UpdateSkillRequestSchema, { slug })),
      toAppError,
    )
  }

  deleteSkill(slug: string): ResultAsync<DeleteSkillResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.deleteSkill(create(DeleteSkillRequestSchema, { slug })),
      toAppError,
    )
  }

  listSkills(): ResultAsync<ListSkillsResponse, AppError> {
    return ResultAsync.fromPromise(
      this.client.listSkills({}),
      toAppError,
    )
  }

  getSkill(slug: string): ResultAsync<SkillInfo, AppError> {
    return ResultAsync.fromPromise(
      this.client.getSkill(create(GetSkillRequestSchema, { slug })),
      toAppError,
    )
  }
}
