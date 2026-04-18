import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace FilesystemTools {

  model ReadArgs {
    path: string;

    @minValue(1)
    offset?: int32;

    @minValue(1) @maxValue(10000)
    limit?: int32;
  }

  model ReadResult {
    content: string;
    truncated: boolean;
    totalLines: int32;
  }

  model WriteArgs {
    path: string;
    content: string;
    createDirs?: boolean;
  }

  model EditArgs {
    path: string;
    oldString: string;
    newString: string;
    replaceAll?: boolean;
  }

  model MultiEditArgs {
    path: string;
    edits: EditOperation[];
  }

  model EditOperation {
    oldString: string;
    newString: string;
  }

  model ApplyPatchArgs {
    patch: string;
  }

  model GlobArgs {
    pattern: string;
    path?: string;
  }

  model GrepArgs {
    pattern: string;
    path?: string;
    include?: string;

    @maxValue(1000)
    maxResults?: int32;
  }

  model LsArgs {
    path?: string;
  }
}
