import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace WmEntities {

  @jsonSchema
  @extension("x-table", "wm_workspaces")
  @extension("x-primary-key", "id")
  @extension("x-indexes", #[
    #["state"],
    #["createdBySessionId"]
  ])
  model WmWorkspace {
    id: string;
    volumeName: string;
    state: string;
    createdBySessionId: string;
    createdAt: int64;
    updatedAt: int64;
    workerPodName: string;
    skillSlugs: string;
    nixPkgs: string;
  }

  @jsonSchema
  @extension("x-table", "wm_workers")
  @extension("x-primary-key", "id")
  @extension("x-indexes", #[
    #["sessionId"],
    #["state"],
    #["containerName"]
  ])
  model WmWorker {
    id: string;
    sessionId: string;
    containerName: string;
    image: string;
    state: string;
    podmanId: string;
    secret: string;
    workspaceRoot: string;
    filesystemUrl: string;
    executionUrl: string;
    createdAt: int64;
    updatedAt: int64;
    workspaceId: string;
  }
}
