import { ResultAsync } from "neverthrow"
import { toAppError } from "@openzerg/common"
import type { IToolServerManager } from "@openzerg/common"
import { LLMClient, type LLMTool } from "../llm/index.js"
import { EventBus } from "../event-bus/index.js"
import { SessionStateManager } from "./session-state.js"
import { Compaction } from "./compaction.js"
import { MessageBuilder, type SystemPromptParts } from "./message-builder.js"
import { MessageStore } from "./message-store.js"
import { ProviderResolver, type ProviderConfig, type SessionConfig } from "./provider-resolver.js"
import type { DB } from "../db/index.js"

const MAX_TOOL_ITERATIONS = 50

export class AgentLoop {
  private messageStore: MessageStore
  private messageBuilder: MessageBuilder
  private compaction: Compaction
  private providerResolver: ProviderResolver
  private configCache = new Map<string, SessionConfig>()
  private previousSystemPrompt = new Map<string, string>()

  constructor(
    private db: DB,
    private eventBus: EventBus,
    private stateManager: SessionStateManager,
    private tsm: IToolServerManager,
  ) {
    this.messageStore = new MessageStore(db)
    this.messageBuilder = new MessageBuilder(db)
    this.providerResolver = new ProviderResolver(db, null)
    this.compaction = new Compaction(this.messageStore, stateManager, eventBus)
  }

  async chat(sessionId: string, content: string): Promise<void> {
    const state = this.stateManager.getOrCreate(sessionId)

    if (state.sessionState === "running" || state.sessionState === "compacting") {
      this.stateManager.pushPendingMessage(sessionId, content)
      return
    }

    const config = await this.loadSessionConfig(sessionId)
    const prevPrompt = this.previousSystemPrompt.get(sessionId)
    const switched = prevPrompt !== undefined && prevPrompt !== config.systemPrompt

    const finalContent = switched
      ? `<system-reminder>\nYour operational mode has changed.\nFollow the new system prompt from now on.\n</system-reminder>\n\n${content}`
      : content

    await this.messageStore.insert(sessionId, "user", finalContent)
    this.previousSystemPrompt.set(sessionId, config.systemPrompt)
    this.emit(sessionId, "user_message", { content })
    await this.runLoop(sessionId)

    const pending = this.stateManager.drainPendingMessages(sessionId)
    if (pending) {
      await this.chat(sessionId, pending)
    }
  }

  interrupt(sessionId: string): boolean {
    return this.stateManager.abort(sessionId)
  }

  async deleteMessagesFrom(sessionId: string, messageId: string): Promise<number> {
    return this.messageStore.deleteFrom(sessionId, messageId)
  }

  private async loadSessionConfig(sessionId: string): Promise<SessionConfig> {
    const cached = this.configCache.get(sessionId)
    if (cached) return cached

    const result = await this.providerResolver.loadSessionConfig(sessionId)
    if (result.isErr()) {
      return { systemPrompt: "", toolServers: "[]", skills: "[]", extraPkgs: "[]" }
    }
    this.configCache.set(sessionId, result.value)
    return result.value
  }

  private async buildSystemParts(sessionId: string, config: SessionConfig): Promise<SystemPromptParts> {
    const skillContext = await this.buildSkillContext(config.skills)
    return { stable: config.systemPrompt, variable: skillContext }
  }

  private async buildSkillContext(skillsJson: string): Promise<string> {
    try {
      const parsed = JSON.parse(skillsJson || "[]")
      if (!Array.isArray(parsed) || parsed.length === 0) return ""
      const slugs = parsed.map((p: unknown) =>
        typeof p === "string" ? p : (p as Record<string, unknown>).slug
      ).filter((s): s is string => typeof s === "string")
      if (slugs.length === 0) return ""
      const rows = await this.db.selectFrom("registry_skills")
        .select(["slug", "name", "description"])
        .where("slug", "in", slugs).execute()
      if (rows.length === 0) return ""
      const entries = rows.map(s =>
        `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`
      ).join("\n")
      return ["<available_skills>", entries, "</available_skills>", "",
        "Skills are mounted read-only at /skills/<slug>/."].join("\n")
    } catch { return "" }
  }

  private async resolveTools(sessionId: string, toolServerTypes: string[]): Promise<{ tools: LLMTool[]; systemContext: string }> {
    if (toolServerTypes.length === 0) return { tools: [], systemContext: "" }
    const result = await this.tsm.resolveTools(sessionId, toolServerTypes)
    if (result.isErr()) return { tools: [], systemContext: "" }
    return {
      tools: result.value.tools.map(t => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: JSON.parse(t.inputSchemaJson || "{}") },
      })),
      systemContext: result.value.systemContext,
    }
  }

  private async executeTool(sessionId: string, toolName: string, argsJson: string, sessionToken: string) {
    const result = await this.tsm.executeTool({ sessionId, toolName, argsJson, sessionToken })
    if (result.isErr()) return { output: result.error.message, success: false }
    const r = result.value
    return { output: r.resultJson, success: r.success }
  }

  private async getToolServerTypes(config: SessionConfig): Promise<string[]> {
    try {
      const parsed = JSON.parse(config.toolServers || "[]")
      if (!Array.isArray(parsed)) return []
      return parsed.map((p: unknown) =>
        typeof p === "string" ? p : (p as Record<string, unknown>).type
      ).filter((t): t is string => typeof t === "string" && !!t)
    } catch { return [] }
  }

  private async getSessionToken(sessionId: string): Promise<string> {
    const r = await ResultAsync.fromPromise(
      this.db.selectFrom("registry_sessions").select(["sessionToken"])
        .where("id", "=", sessionId).executeTakeFirst(),
      toAppError,
    )
    return r.isOk() ? (r.value?.sessionToken ?? "") : ""
  }

  private async runLoop(sessionId: string): Promise<void> {
    this.stateManager.transition(sessionId, "running")
    const ac = new AbortController()
    this.stateManager.setAbortController(sessionId, ac)

    const result = await ResultAsync.fromPromise(this.executeLoop(sessionId, ac), toAppError)
    result.match(
      () => { this.emit(sessionId, "done", {}) },
      (err) => {
        const isAbort = err.message?.includes("aborted") || err.message?.includes("Abort")
        this.emit(sessionId, isAbort ? "interrupted" : "error",
          { message: isAbort ? "User interrupted" : err.message })
      },
    )
    this.stateManager.transition(sessionId, "idle")
  }

  private async executeLoop(sessionId: string, ac: AbortController): Promise<void> {
    const providerResult = await this.providerResolver.resolveProvider(sessionId)
    if (providerResult.isErr()) { this.emit(sessionId, "error", { message: providerResult.error.message }); return }
    const provider = providerResult.value
    const llm = new LLMClient(provider)
    const config = await this.loadSessionConfig(sessionId)

    const toolTypes = await this.getToolServerTypes(config)
    const { tools, systemContext } = await this.resolveTools(sessionId, toolTypes)
    if (tools.length > 0) {
      this.emit(sessionId, "tools_resolved", { count: tools.length, names: tools.map(t => t.function.name) })
    }

    const sessionToken = await this.getSessionToken(sessionId)
    const systemParts = await this.buildSystemParts(sessionId, config)
    const mergedVariable = [systemParts.variable, systemContext].filter(Boolean).join("\n\n")
    const finalParts: SystemPromptParts = { stable: systemParts.stable, variable: mergedVariable }

    let iterations = 0
    let hasToolCalls = true

    while (hasToolCalls) {
      if (ac.signal.aborted) { this.emit(sessionId, "interrupted", { message: "User interrupted" }); return }
      if (iterations >= MAX_TOOL_ITERATIONS) { this.emit(sessionId, "error", { message: `Tool iteration limit (${MAX_TOOL_ITERATIONS})` }); break }
      iterations++

      const messages = await this.messageBuilder.build(sessionId, finalParts)
      const llmTools = tools.length > 0 ? tools : undefined
      let assistantContent = ""
      let usage = { inputTokens: 0, outputTokens: 0 }
      let toolCallBuffers: Array<{ id: string; name: string; args: string }> = []

      for await (const chunk of llm.stream(messages, llmTools, ac.signal)) {
        if (ac.signal.aborted) { this.emit(sessionId, "interrupted", { message: "User interrupted" }); return }
        switch (chunk.type) {
          case "text": assistantContent += chunk.content ?? ""; this.emit(sessionId, "response", { content: chunk.content, streaming: true }); break
          case "tool_call_end": toolCallBuffers.push({ id: chunk.toolCallId!, name: chunk.toolName!, args: chunk.content ?? "" }); this.emit(sessionId, "tool_call", { callId: chunk.toolCallId, toolName: chunk.toolName }); break
          case "usage": if (chunk.usage) usage = chunk.usage; break
        }
      }

      this.emit(sessionId, "response", { content: assistantContent, streaming: false })
      await this.messageStore.insert(sessionId, "assistant", assistantContent, {
        metadata: JSON.stringify({ toolCalls: toolCallBuffers.map(tc => ({ id: tc.id, name: tc.name })) }),
        tokenUsage: JSON.stringify(usage),
      })
      await this.messageStore.addTokenUsage(sessionId, usage)

      if (provider.autoCompactLength > 0) {
        const compacted = await this.compaction.autoCompact(sessionId, provider, config.systemPrompt, ac.signal)
        if (compacted) continue
      }

      if (toolCallBuffers.length === 0) { hasToolCalls = false } else {
        for (const tc of toolCallBuffers) {
          this.emit(sessionId, "tool_executing", { callId: tc.id, toolName: tc.name })
          const result = await this.executeTool(sessionId, tc.name, tc.args, sessionToken)
          await this.messageStore.insert(sessionId, "tool", result.output, {
            toolCallId: tc.id, toolName: tc.name, metadata: JSON.stringify({ success: result.success }),
          })
          this.emit(sessionId, "tool_result", { callId: tc.id, toolName: tc.name, content: result.output, success: result.success })
        }
      }
    }
  }

  private emit(sessionId: string, type: string, data: unknown): void {
    this.eventBus.emit({ sessionId, type, data })
  }
}
