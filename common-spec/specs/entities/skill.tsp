import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace SkillEntities {

  @jsonSchema
  @extension("x-table", "registry_skills")
  @extension("x-primary-key", "id")
  @extension("x-unique", #["slug"])
  model Skill {
    id: string;
    slug: string;
    name: string;
    description: string;
    gitUrl: string;
    localPath: string;
    commitHash: string;
    pkgs: string;
    createdAt: int64;
    updatedAt: int64;
  }
}
