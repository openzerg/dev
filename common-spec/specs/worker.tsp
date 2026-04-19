import "@typespec/protobuf";

using Protobuf;

/**
 * WorkerService — Workspace 内的最小执行代理
 * Exec + Spawn 用于命令执行
 * ReadFile / WriteFile / Stat 用于结构化文件访问（零 shell 注入）
 * ZCP server 通过 ConnectRPC 调用，Bearer token 鉴权
 */
@package({ name: "worker.v1" })
namespace WorkerV1 {

  @Protobuf.service
  interface WorkerService {
    exec(...ExecRequest): ExecResponse;
    spawn(...SpawnRequest): SpawnResponse;
    readFile(...ReadFileRequest): ReadFileResponse;
    writeFile(...WriteFileRequest): WriteFileResponse;
    stat(...StatRequest): StatResponse;
    installPackages(...InstallPackagesRequest): InstallPackagesResponse;
    health(...HealthRequest): HealthResponse;
  }

  @message model ExecRequest {
    @field(1) command:    string;
    @field(2) workdir:    string;
    @field(3) env:        Map<string, string>;
    @field(4) timeoutMs:  int32;
  }

  @message model ExecResponse {
    @field(1) exitCode: int32;
    @field(2) stdout:   bytes;
    @field(3) stderr:   bytes;
    @field(4) timedOut: boolean;
  }

  @message model SpawnRequest {
    @field(1) jobId:   string;
    @field(2) command: string;
    @field(3) workdir: string;
    @field(4) env:     Map<string, string>;
  }

  @message model SpawnResponse {
    @field(1) started: boolean;
    @field(2) error:   string;
  }

  @message model ReadFileRequest {
    @field(1) path: string;
  }

  @message model ReadFileResponse {
    @field(1) content: bytes;
    @field(2) mtimeMs: int64;
  }

  @message model WriteFileRequest {
    @field(1) path:            string;
    @field(2) content:         bytes;
    @field(3) expectedMtimeMs: int64;
  }

  @message model WriteFileResponse {
    @field(1) actualMtimeMs: int64;
  }

  @message model StatRequest {
    @field(1) path: string;
  }

  @message model StatResponse {
    @field(1) exists:  boolean;
    @field(2) isFile:  boolean;
    @field(3) isDir:   boolean;
    @field(4) size:    int64;
    @field(5) mtimeMs: int64;
  }

  @message model InstallPackagesRequest {
    @field(1) packages: string[];
  }

  @message model InstallPackagesResponse {
    @field(1) installed: string[];
    @field(2) failed:    string[];
    @field(3) envShPath: string;
  }

  @message model HealthRequest {}

  @message model HealthResponse {
    @field(1) status: string;
  }
}
