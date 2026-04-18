import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace ExecutionTools {

  model JobRunArgs {
    command: string;
    args?: string[];
    cwd?: string;
    timeoutMs?: int32;
  }

  model JobRunResult {
    processId: string;
    pid: int32;
  }

  model JobListArgs {}

  model JobInfo {
    processId: string;
    command: string;
    status: string;
    exitCode?: int32;
    startedAt: string;
  }

  model JobKillArgs {
    processId: string;
    signal?: string;
  }

  model JobOutputArgs {
    processId: string;
    stream?: string;
    offset?: int32;
    limit?: int32;
  }

  model JobOutputResult {
    output: string;
    hasMore: boolean;
    nextOffset: int32;
    exitCode?: int32;
    done: boolean;
  }
}
