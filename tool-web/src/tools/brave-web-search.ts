import type { ITool } from "@openzerg/tool-server-sdk"
import { z } from "zod"
import { ok, err, errAsync, type Result, ResultAsync } from "neverthrow"
import { AppError, ValidationError, UpstreamError, toAppError } from "@openzerg/common"
import { parseArgs } from "@openzerg/tool-server-sdk"
import {
  abortWithTimeout,
  BRAVE_API_KEY,
  BRAVE_BASE_URL,
  WEBSEARCH_TIMEOUT,
} from "./shared.js"

const BraveWebSearchSchema = z.object({
  query: z.string().describe("Web search query"),
  count: z.number().optional().describe("Number of search results (default: 10, max: 20)"),
  offset: z.number().optional().describe("Offset for pagination (default: 0)"),
  country: z.string().optional().describe("Country code (e.g. 'us', 'cn')"),
  search_lang: z.string().optional().describe("Search language (e.g. 'en', 'zh')"),
  freshness: z.enum(["pd", "pw", "pm", "py"]).optional().describe("Freshness filter: pd=24h, pw=week, pm=month, py=year"),
})

interface BraveWebResult {
  title: string
  url: string
  description: string
  age?: string
  page_age?: string
  extra_snippets?: string[]
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[]
  }
  query?: {
    original?: string
  }
}

function formatBraveResults(data: BraveSearchResponse): string {
  const results = data.web?.results ?? []
  if (results.length === 0) return "No search results found. Please try a different query."

  const lines: string[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    lines.push(`## ${i + 1}. ${r.title}`)
    lines.push(`URL: ${r.url}`)
    if (r.age || r.page_age) lines.push(`Date: ${r.age ?? r.page_age ?? ""}`)
    lines.push(``)
    const desc = r.description?.replace(/<[^>]+>/g, "") ?? ""
    if (desc) lines.push(desc)
    if (r.extra_snippets?.length) {
      lines.push(``)
      for (const s of r.extra_snippets) {
        lines.push(`> ${s.replace(/<[^>]+>/g, "")}`)
      }
    }
    lines.push(``)
  }
  return lines.join("\n")
}

export const braveWebSearchTool: ITool = {
  name: "brave-web-search",
  description:
    "Search the web using Brave Search API. Returns search results with titles, URLs, descriptions, and extra snippets. Supports freshness filtering and language settings. Requires BRAVE_API_KEY.",
  group: "web",
  priority: 10,
  dependencies: [],
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Web search query" },
      count: { type: "number", description: "Number of results (default: 10, max: 20)" },
      offset: { type: "number", description: "Offset for pagination (default: 0)" },
      country: { type: "string", description: "Country code (e.g. 'us', 'cn')" },
      search_lang: { type: "string", description: "Search language (e.g. 'en', 'zh')" },
      freshness: { type: "string", enum: ["pd", "pw", "pm", "py"], description: "Freshness: pd=24h, pw=week, pm=month, py=year" },
    },
    required: ["query"],
  },
  outputSchema: {
    type: "object",
    properties: { content: { type: "string" } },
  },
  execute(argsJson, _sessionToken, _getContext): ResultAsync<unknown, AppError> {
    return new ResultAsync((async (): Promise<Result<unknown, AppError>> => {
      const argsR = parseArgs(BraveWebSearchSchema, argsJson)
      if (argsR.isErr()) return err(argsR.error)
      const args = argsR.value

      if (!BRAVE_API_KEY) {
        return err(new ValidationError("BRAVE_API_KEY is not configured. Set the environment variable to use brave-web-search."))
      }

      const params = new URLSearchParams()
      params.set("q", args.query)
      if (args.count) params.set("count", String(Math.min(args.count, 20)))
      if (args.offset) params.set("offset", String(args.offset))
      if (args.country) params.set("country", args.country)
      if (args.search_lang) params.set("search_lang", args.search_lang)
      if (args.freshness) params.set("freshness", args.freshness)

      const url = `${BRAVE_BASE_URL}/res/v1/web/search?${params.toString()}`

      const { signal, clear } = abortWithTimeout(WEBSEARCH_TIMEOUT)

      return ResultAsync.fromPromise(
        fetch(url, {
          method: "GET",
          headers: {
            accept: "application/json",
            "X-Subscription-Token": BRAVE_API_KEY,
          },
          signal,
        }),
        (e) => {
          clear()
          if (e instanceof Error && e.name === "AbortError") return new UpstreamError("Brave search request timed out")
          return toAppError(e)
        },
      ).andThen((response) => {
        clear()
        if (!response.ok) {
          return ResultAsync.fromPromise(
            response.text(),
            toAppError,
          ).andThen((errorText) =>
            errAsync<never, AppError>(new UpstreamError(`Brave search error (${response.status}): ${errorText}`)),
          )
        }
        return ResultAsync.fromPromise(response.json() as Promise<BraveSearchResponse>, toAppError).map((data) => ({
          content: formatBraveResults(data),
        }))
      }).match(
        (v) => ok(v),
        (e) => err(e),
      )
    })())
  },
}
