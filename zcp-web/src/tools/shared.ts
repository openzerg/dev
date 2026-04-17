import TurndownService from "turndown"

export const MAX_RESPONSE_SIZE = 5 * 1024 * 1024
export const WEBSEARCH_TIMEOUT = 25_000
export const WEBFETCH_DEFAULT_TIMEOUT = 30_000
export const WEBFETCH_MAX_TIMEOUT = 120_000

export const EXA_BASE_URL = process.env.EXA_BASE_URL ?? "https://mcp.exa.ai"
export const EXA_API_KEY = process.env.EXA_API_KEY ?? ""
export const BRAVE_API_KEY = process.env.BRAVE_API_KEY ?? ""
export const BRAVE_BASE_URL = process.env.BRAVE_BASE_URL ?? "https://api.search.brave.com"
export const DEFAULT_NUM_RESULTS = 8

export function abortWithTimeout(ms: number, parent?: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  const combined = parent ? AbortSignal.any([ctrl.signal, parent]) : ctrl.signal
  return { signal: combined, clear: () => clearTimeout(id) }
}

export function convertHtmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  })
  td.remove(["script", "style", "meta", "link"])
  return td.turndown(html)
}

export async function extractTextFromHtml(html: string): Promise<string> {
  let text = ""
  let skipContent = false
  const skipTags = new Set(["script", "style", "noscript", "iframe", "object", "embed"])

  const rewriter = new HTMLRewriter()
    .on("script, style, noscript, iframe, object, embed", {
      element() {
        skipContent = true
      },
      text() {
      },
    })
    .on("*", {
      element(element) {
        if (!skipTags.has(element.tagName)) {
          skipContent = false
        }
      },
      text(input) {
        if (!skipContent) {
          text += input.text
        }
      },
    })
    .transform(new Response(html))

  await rewriter.text()
  return text.trim()
}
