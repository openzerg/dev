import "@typespec/protobuf";

using Protobuf;

@package({ name: "workspacemanager.v1" })
namespace WorkspaceManagerV1 {

  @message model WmWorkspaceInfo {
    @field(1) workspaceId:        string;
    @field(2) volumeName:         string;
    @field(3) state:              string;
    @field(4) createdBySessionId: string;
    @field(5) createdAt:          int64;
    @field(6) workerPodName:      string;
    @field(7) skillSlugs:         string;
    @field(8) nixPkgs:            string;
  }

  @message model WmWorkerInfo {
    @field(1)  workerId:      string;
    @field(2)  sessionId:     string;
    @field(3)  containerName: string;
    @field(4)  image:         string;
    @field(5)  state:         string;
    @field(6)  podmanId:      string;
    @field(7)  secret:        string;
    @field(8)  workspaceRoot: string;
    @field(9)  filesystemUrl: string;
    @field(10) executionUrl:  string;
    @field(11) createdAt:     int64;
    @field(12) workspaceId:   string;
  }

  @message model ContainerVolume {
    @field(1) name:        string;
    @field(2) destination: string;
  }

  @message model CreateWorkspaceRequest {
    @field(1) sessionId: string;
  }

  @message model CreateWorkspaceResponse {
    @field(1) workspaceId: string;
    @field(2) volumeName:  string;
  }

  @message model ListWorkspacesRequest {}

  @message model ListWorkspacesResponse {
    @field(1) workspaces: WmWorkspaceInfo[];
  }

  @message model GetWorkspaceRequest {
    @field(1) workspaceId: string;
  }

  @message model DeleteWorkspaceRequest {
    @field(1) workspaceId: string;
  }

  @message model DeleteWorkspaceResponse {}

  @message model StartWorkerRequest {
    @field(1) sessionId: string;
    @field(2) image:     string;
    @field(3) env:       Map<string, string>;
    @field(4) volumes:   ContainerVolume[];
    @field(5) command:   string[];
  }

  @message model StartWorkerResponse {
    @field(1) workerId:      string;
    @field(2) containerName: string;
    @field(3) secret:        string;
  }

  @message model StopWorkerRequest {
    @field(1) workerId: string;
  }

  @message model StopWorkerResponse {}

  @message model GetWorkerStatusRequest {
    @field(1) workerId: string;
  }

  @message model GetWorkerStatusResponse {
    @field(1) state:       string;
    @field(2) containerId: string;
  }

  @message model ListWorkersRequest {}

  @message model ListWorkersResponse {
    @field(1) workers: WmWorkerInfo[];
  }

  @message model EnsureWorkspaceWorkerRequest {
    @field(1) workspaceId: string;
    @field(2) image:        string;
    @field(3) env:          Map<string, string>;
  }

  @message model EnsureWorkspaceWorkerResponse {
    @field(1) workerId:      string;
    @field(2) containerName: string;
    @field(3) secret:        string;
    @field(4) volumeName:    string;
  }

  @message model UpdateWorkspaceConfigRequest {
    @field(1) workspaceId: string;
    @field(2) skillSlugs:  string;
    @field(3) nixPkgs:     string;
  }

  @message model UpdateWorkspaceConfigResponse {}

  @message model HealthRequest {}

  @message model HealthResponse {
    @field(1) status: string;
  }

  @Protobuf.service
  interface WorkspaceManagerService {
    health(...HealthRequest): HealthResponse;

    createWorkspace(...CreateWorkspaceRequest): CreateWorkspaceResponse;
    listWorkspaces(...ListWorkspacesRequest): ListWorkspacesResponse;
    getWorkspace(...GetWorkspaceRequest): WmWorkspaceInfo;
    deleteWorkspace(...DeleteWorkspaceRequest): DeleteWorkspaceResponse;

    startWorker(...StartWorkerRequest): StartWorkerResponse;
    stopWorker(...StopWorkerRequest): StopWorkerResponse;
    getWorkerStatus(...GetWorkerStatusRequest): GetWorkerStatusResponse;
    listWorkers(...ListWorkersRequest): ListWorkersResponse;

    ensureWorkspaceWorker(...EnsureWorkspaceWorkerRequest): EnsureWorkspaceWorkerResponse;
    updateWorkspaceConfig(...UpdateWorkspaceConfigRequest): UpdateWorkspaceConfigResponse;
  }
}
