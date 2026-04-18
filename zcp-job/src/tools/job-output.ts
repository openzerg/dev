import type { IZcpTool } from "@openzerg/zcp"
import { ResultAsync, err, ok } from "neverthrow"
import { z } from "zod"
import { parseArgs, WorkerSession } from "./shared.js"

const JobOutputSchema = z.object({
  jobId: z.string(),
  offset: z.number().optional(),
})

export const jobOutputTool: IZcpTool = {
  name: "job-output",
  description: "Get output from an async job. Returns stdout/stderr and exit status.",
  group: "execution",
  priority: 10,
  inputSchema: {
    type: "object",
    properties: {
      jobId: { type: "string" },
      offset: { type: "number", description: "Byte offset for stdout" },
    },
    required: ["jobId"],
  },
  outputSchema: {
    type: "object",
    properties: {
      stdout: { type: "string" },
      stderr: { type: "string" },
      exitCode: { type: "number" },
      running: { type: "boolean" },
    },
  },
  execute(argsJson, sessionToken, getContext) {
    return new ResultAsync((async () => {
      const argsR = parseArgs(JobOutputSchema, argsJson)
      if (argsR.isErr()) return err(argsR.error)
      const args = argsR.value
      const ctx = await getContext(sessionToken)
      const worker = new WorkerSession(ctx)

      const exitCodeResult = await worker.getJobExitCode(args.jobId)
      if (exitCodeResult.isErr()) return err(exitCodeResult.error)
      const exitCode = exitCodeResult.value
      const running = exitCode === null

      const stdoutResult = await worker.readJobFile(args.jobId, "stdout")
      if (stdoutResult.isErr()) return err(stdoutResult.error)
      let stdout: string = stdoutResult.value ?? ""
      if (args.offset && args.offset > 0) {
        const bytes = new TextEncoder().encode(stdout)
        stdout = new TextDecoder().decode(bytes.slice(args.offset))
      }

      const stderrResult = await worker.readJobFile(args.jobId, "stderr")
      if (stderrResult.isErr()) return err(stderrResult.error)
      const stderr: string = stderrResult.value ?? ""

      return ok({ stdout, stderr, exitCode: running ? null : exitCode, running })
    })())
  },
}
