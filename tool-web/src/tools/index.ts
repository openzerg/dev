import type { ITool } from "@openzerg/tool-server-sdk"
import { exaWebSearchTool } from "./exa-web-search.js"
import { braveWebSearchTool } from "./brave-web-search.js"
import { webFetchTool } from "./webfetch.js"

export function createWebTools(): ITool[] {
  return [exaWebSearchTool, braveWebSearchTool, webFetchTool]
}
