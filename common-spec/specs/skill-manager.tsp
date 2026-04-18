import "@typespec/protobuf";

using Protobuf;

/**
 * SkillManagerService — Skill 管理服务
 * 负责 git clone/pull、解析 SKILL.md frontmatter、管理 skill 元数据
 */
@package({ name: "skillmanager.v1" })
namespace SkillManagerV1 {

  @message model RegisterSkillRequest {
    @field(1) slug: string;
    @field(2) gitUrl: string;
  }

  @message model RegisterSkillResponse {
    @field(1) skill: SkillInfo;
  }

  @message model UpdateSkillRequest {
    @field(1) slug: string;
  }

  @message model UpdateSkillResponse {
    @field(1) skill: SkillInfo;
  }

  @message model DeleteSkillRequest {
    @field(1) slug: string;
  }

  @message model DeleteSkillResponse {}

  @message model ListSkillsRequest {}

  @message model ListSkillsResponse {
    @field(1) skills: SkillInfo[];
  }

  @message model GetSkillRequest {
    @field(1) slug: string;
  }

  @message model SkillInfo {
    @field(1) id: string;
    @field(2) slug: string;
    @field(3) name: string;
    @field(4) description: string;
    @field(5) gitUrl: string;
    @field(6) localPath: string;
    @field(7) commitHash: string;
    @field(8) pkgs: string;
    @field(9) createdAt: int64;
    @field(10) updatedAt: int64;
  }

  @Protobuf.service
  interface SkillManagerService {
    registerSkill(...RegisterSkillRequest): RegisterSkillResponse;
    updateSkill(...UpdateSkillRequest): UpdateSkillResponse;
    deleteSkill(...DeleteSkillRequest): DeleteSkillResponse;
    listSkills(...ListSkillsRequest): ListSkillsResponse;
    getSkill(...GetSkillRequest): SkillInfo;
  }
}
