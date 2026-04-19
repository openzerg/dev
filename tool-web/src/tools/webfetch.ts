import type { ITool } from "@openzerg/tool-server-sdk"
import { z } from "zod"
import { ok, err, type Result, ResultAsync } from "neverthrow"
import { AppError, ValidationError, UpstreamError, toAppError } from "@openzerg/common"
import { parseArgs } from "@openzerg/tool-server-sdk"
import {
  abortWithTimeout,
  convertHtmlToMarkdown,
  extractTextFromHtml,
  MAX_RESPONSE_SIZE,
  WEBFETCH_DEFAULT_TIMEOUT,
  WEBFETCH_MAX_TIMEOUT,
} from "./shared.js"

const WebFetchSchema = z.object({
  url: z.string().describe("The URL to fetch content from"),
  format: z.enum(["text", "markdown", "html"]).optional().describe("Output format (default: markdown)"),
  timeout: z.number().optional().describe("Timeout in seconds (max 120)"),
})

export const webFetchTool: ITool = {
  name: "web-fetch",
  description:
    "Fetches content from a specified URL. Takes a URL and optional format as input. Fetches the URL content, converts to requested format (markdown by default). Returns the content in the specified format.",
  group: "web",
  priority: 20,
  dependencies: [],
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch (http:// or https://)" },
      format: { type: "string", enum: ["text", "markdown", "html"], description: "Output format (default: markdown)" },
      timeout: { type: "number", description: "Timeout in seconds (max 120)" },
    },
    required: ["url"],
  },
  outputSchema: {
    type: "object",
    properties: {
      content: { type: "string" },
      url: { type: "string" },
      contentType: { type: "string" },
    },
  },
  execute(argsJson, _sessionToken, _getContext): ResultAsync<unknown, AppError> {
    return new ResultAsync((async (): Promise<Result<unknown, AppError>> => {
      const argsR = parseArgs(WebFetchSchema, argsJson)
      if (argsR.isErr()) return err(argsR.error)
      const args = argsR.value

      if (!args.url.startsWith("http://") && !args.url.startsWith("https://")) {
        return err(new ValidationError("URL must start with http:// or https://"))
      }

      const format = args.format ?? "markdown"
      const timeoutMs = Math.min(
        (args.timeout ?? WEBFETCH_DEFAULT_TIMEOUT / 1000) * 1000,
        WEBFETCH_MAX_TIMEOUT,
      )

      let acceptHeader = "*/*"
      switch (format) {
        case "markdown":
          acceptHeader = "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1"
          break
        case "text":
          acceptHeader = "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1"
          break
        case "html":
          acceptHeader = "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1"
          break
        default:
          acceptHeader = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      }

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        Accept: acceptHeader,
        "Accept-Language": "en-US,en;q=0.9",
      }

      const { signal, clear } = abortWithTimeout(timeoutMs)

      const initialResult = await ResultAsync.fromPromise(
        fetch(args.url, { signal, headers }),
        (e) => {
          clear()
          if (e instanceof Error && e.name === "AbortError") return new UpstreamError("Fetch request timed out")
          return toAppError(e)
        },
      )
      if (initialResult.isErr()) return err(initialResult.error)

      let response = initialResult.value

      if (response.status === 403 && response.headers.get("cf-mitigated") === "challenge") {
        const retryResult = await ResultAsync.fromPromise(
          fetch(args.url, { signal, headers: { ...headers, "User-Agent": "opencode" } }),
          (e) => {
            clear()
            return toAppError(e)
          },
        )
        if (retryResult.isErr()) return err(retryResult.error)
        response = retryResult.value
      }

      clear()

      if (!response.ok) {
        return err(new UpstreamError(`Request failed with status code: ${response.status}`))
      }

      const contentLength = response.headers.get("content-length")
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        return err(new ValidationError("Response too large (exceeds 5MB limit)"))
      }

      const bufResult = await ResultAsync.fromPromise(response.arrayBuffer(), toAppError)
      if (bufResult.isErr()) return err(bufResult.error)
      const arrayBuffer = bufResult.value

      if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
        return err(new ValidationError("Response too large (exceeds 5MB limit)"))
      }

      const contentType = response.headers.get("content-type") ?? ""
      const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? ""
      const title = `${args.url} (${contentType})`

      const isImage = mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/vnd.fastbidsheet"

      if (isImage) {
        const b64 = Buffer.from(arrayBuffer).toString("base64")
        return ok({
          content: "Image fetched successfully",
          url: args.url,
          contentType,
          title,
          attachments: [
            {
              type: "file" as const,
              mime,
              url: `data:${mime};base64,${b64}`,
            },
          ],
        })
      }

      const rawContent = new TextDecoder().decode(arrayBuffer)

      if (format === "html") {
        return ok({ content: rawContent, url: args.url, contentType, title })
      }

      if (contentType.includes("text/html")) {
        switch (format) {
          case "markdown": {
            const converted = convertHtmlToMarkdown(rawContent)
            return ok({ content: converted, url: args.url, contentType, title })
          }
          case "text": {
            const converted = await extractTextFromHtml(rawContent)
            return ok({ content: converted, url: args.url, contentType, title })
          }
        }
      }

      return ok({ content: rawContent, url: args.url, contentType, title })
    })())
  },
}
