import type { IZcpTool } from "@openzerg/zcp"
import { jobRunTool } from "./job-run.js"
import { jobOutputTool } from "./job-output.js"
import { jobListTool } from "./job-list.js"
import { jobKillTool } from "./job-kill.js"

export function createJobTools(): IZcpTool[] {
  return [jobRunTool, jobOutputTool, jobListTool, jobKillTool]
}
