import type { ITool } from "@openzerg/tool-server-sdk"
import { z } from "zod"
import { ok, err, errAsync, type Result, ResultAsync } from "neverthrow"
import { AppError, UpstreamError, toAppError } from "@openzerg/common"
import { parseArgs } from "@openzerg/tool-server-sdk"
import {
  abortWithTimeout,
  EXA_BASE_URL,
  EXA_API_KEY,
  WEBSEARCH_TIMEOUT,
  DEFAULT_NUM_RESULTS,
} from "./shared.js"

const ExaWebSearchSchema = z.object({
  query: z.string().describe("Web search query"),
  numResults: z.number().optional().describe("Number of search results (default: 8)"),
  livecrawl: z.enum(["fallback", "preferred"]).optional().describe("Live crawl mode"),
  type: z.enum(["auto", "fast", "deep"]).optional().describe("Search type"),
  contextMaxCharacters: z.number().optional().describe("Max chars for context (default: 10000)"),
})

interface McpResponse {
  result?: {
    content?: Array<{ type: string; text: string }>
  }
}

export const exaWebSearchTool: ITool = {
  name: "exa-web-search",
  description:
    "Search the web using Exa AI. Performs real-time web searches and returns content from the most relevant websites. Use for accessing up-to-date information beyond knowledge cutoff.",
  group: "web",
  priority: 20,
  dependencies: [],
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Web search query" },
      numResults: { type: "number", description: "Number of results (default: 8)" },
      livecrawl: { type: "string", enum: ["fallback", "preferred"], description: "Live crawl mode" },
      type: { type: "string", enum: ["auto", "fast", "deep"], description: "Search type" },
      contextMaxCharacters: { type: "number", description: "Max chars for LLM context" },
    },
    required: ["query"],
  },
  outputSchema: {
    type: "object",
    properties: { content: { type: "string" } },
  },
  execute(argsJson, _sessionToken, _getContext): ResultAsync<unknown, AppError> {
    return new ResultAsync((async (): Promise<Result<unknown, AppError>> => {
      const argsR = parseArgs(ExaWebSearchSchema, argsJson)
      if (argsR.isErr()) return err(argsR.error)
      const args = argsR.value

      const mcpRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "web_search_exa",
          arguments: {
            query: args.query,
            type: args.type ?? "auto",
            numResults: args.numResults ?? DEFAULT_NUM_RESULTS,
            livecrawl: args.livecrawl ?? "fallback",
            contextMaxCharacters: args.contextMaxCharacters,
          },
        },
      }

      const { signal, clear } = abortWithTimeout(WEBSEARCH_TIMEOUT)

      const headers: Record<string, string> = {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      }
      if (EXA_API_KEY) headers["x-api-key"] = EXA_API_KEY

      return ResultAsync.fromPromise(
        fetch(`${EXA_BASE_URL}/mcp`, {
          method: "POST",
          headers,
          body: JSON.stringify(mcpRequest),
          signal,
        }),
        (e) => {
          clear()
          if (e instanceof Error && e.name === "AbortError") return new UpstreamError("Exa search request timed out")
          return toAppError(e)
        },
      ).andThen((response) => {
        clear()
        if (!response.ok) {
          return ResultAsync.fromPromise(
            response.text(),
            toAppError,
          ).andThen((errorText) =>
            errAsync<never, AppError>(new UpstreamError(`Exa search error (${response.status}): ${errorText}`)),
          )
        }
        return ResultAsync.fromPromise(response.text(), toAppError).map((responseText) => {
          for (const line of responseText.split("\n")) {
            if (line.startsWith("data: ")) {
              const data: McpResponse = JSON.parse(line.substring(6))
              if (data.result?.content?.length) {
                return { content: data.result.content[0].text }
              }
            }
          }
          return { content: "No search results found. Please try a different query." }
        })
      }).match(
        (v) => ok(v),
        (e) => err(e),
      )
    })())
  },
}
