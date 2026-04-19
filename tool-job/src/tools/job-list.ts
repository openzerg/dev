import type { ITool } from "@openzerg/tool-server-sdk"
import { ResultAsync, err, ok } from "neverthrow"
import { parseArgs, WorkerSession, JOBS_DIR } from "./shared.js"

export const jobListTool: ITool = {
  name: "job-list",
  description: "List all jobs with their status.",
  group: "execution",
  priority: 10,
  dependencies: [],
  inputSchema: { type: "object", properties: {} },
  outputSchema: { type: "object", properties: { jobs: { type: "array" } } },
  execute(_argsJson, sessionToken, getContext) {
    return new ResultAsync((async () => {
      const ctx = await getContext(sessionToken)
      const worker = new WorkerSession(ctx)
      const dirInfoResult = await worker.stat(JOBS_DIR)
      if (dirInfoResult.isErr()) return err(dirInfoResult.error)
      if (!dirInfoResult.value.exists) return ok({ jobs: [] })

      const outResult = await worker.exec(`ls -1 ${JOBS_DIR}`)
      if (outResult.isErr()) return err(outResult.error)
      const jobs = outResult.value.trim().split("\n").filter(Boolean)
      const result = []
      for (const jobId of jobs) {
        const exitCodeResult = await worker.getJobExitCode(jobId)
        if (exitCodeResult.isErr()) return err(exitCodeResult.error)
        const exitCode = exitCodeResult.value
        const running = exitCode === null
        result.push({ jobId, running, exitCode })
      }
      return ok({ jobs: result })
    })())
  },
}
