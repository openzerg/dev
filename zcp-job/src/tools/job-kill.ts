import type { IZcpTool } from "@openzerg/zcp"
import { ResultAsync, err, ok } from "neverthrow"
import { z } from "zod"
import { parseArgs, WorkerSession } from "./shared.js"

const JobKillSchema = z.object({ jobId: z.string() })

export const jobKillTool: IZcpTool = {
  name: "job-kill",
  description: "Kill a running job.",
  group: "execution",
  priority: 10,
  inputSchema: {
    type: "object",
    properties: { jobId: { type: "string" } },
    required: ["jobId"],
  },
  outputSchema: { type: "object", properties: { success: { type: "boolean" } } },
  execute(argsJson, sessionToken, getContext) {
    return new ResultAsync((async () => {
      const argsR = parseArgs(JobKillSchema, argsJson)
      if (argsR.isErr()) return err(argsR.error)
      const args = argsR.value
      const ctx = await getContext(sessionToken)
      const worker = new WorkerSession(ctx)

      const pidResult = await worker.readJobFile(args.jobId, "pid")
      if (pidResult.isErr()) return err(pidResult.error)
      if (pidResult.value) {
        const killResult = await worker.exec(`kill ${pidResult.value.trim()} 2>/dev/null; echo done`)
        if (killResult.isErr()) return err(killResult.error)
      }
      return ok({ success: true })
    })())
  },
}
