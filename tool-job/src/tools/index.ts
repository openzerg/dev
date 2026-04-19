import type { ITool } from "@openzerg/tool-server-sdk"
import { jobRunTool } from "./job-run.js"
import { jobOutputTool } from "./job-output.js"
import { jobListTool } from "./job-list.js"
import { jobKillTool } from "./job-kill.js"

export function createJobTools(): ITool[] {
  return [jobRunTool, jobOutputTool, jobListTool, jobKillTool]
}
