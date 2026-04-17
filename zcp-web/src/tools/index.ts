import type { IZcpTool } from "@openzerg/zcp"
import { exaWebSearchTool } from "./exa-web-search.js"
import { braveWebSearchTool } from "./brave-web-search.js"
import { webFetchTool } from "./webfetch.js"

export function createWebTools(): IZcpTool[] {
  return [exaWebSearchTool, braveWebSearchTool, webFetchTool]
}
