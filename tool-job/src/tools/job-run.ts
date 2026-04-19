import type { ITool } from "@openzerg/tool-server-sdk"
import { ResultAsync, err, ok } from "neverthrow"
import { z } from "zod"
import { parseArgs, WorkerSession } from "./shared.js"

const JobRunSchema = z.object({
  command: z.string(),
  workdir: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export const jobRunTool: ITool = {
  name: "job-run",
  description: "Run a long-running command asynchronously. Returns jobId immediately.",
  group: "execution",
  priority: 10,
  dependencies: [],
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string" },
      workdir: { type: "string" },
      env: { type: "object" },
    },
    required: ["command"],
  },
  outputSchema: { type: "object", properties: { jobId: { type: "string" } } },
  execute(argsJson, sessionToken, getContext) {
    return new ResultAsync((async () => {
      const argsR = parseArgs(JobRunSchema, argsJson)
      if (argsR.isErr()) return err(argsR.error)
      const args = argsR.value
      const ctx = await getContext(sessionToken)
      const worker = new WorkerSession(ctx)
      const jobId = crypto.randomUUID()
      const spawnResult = await worker.spawn(jobId, args.command, args.workdir)
      if (spawnResult.isErr()) return err(spawnResult.error)
      return ok({ jobId })
    })())
  },
}
