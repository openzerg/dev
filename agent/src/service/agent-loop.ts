import { ResultAsync } from "neverthrow"
import { toAppError } from "@openzerg/common"
import { LLMClient } from "../llm/index.js"
import { EventBus } from "../event-bus/index.js"
import { SessionStateManager } from "./session-state.js"
import { Compaction } from "./compaction.js"
import { MessageBuilder, type SystemPromptParts } from "./message-builder.js"
import { MessageStore } from "./message-store.js"
import { ProviderResolver, type ProviderConfig, type RoleConfig } from "./provider-resolver.js"
import { ToolManager } from "./tool-manager.js"
import type { DB } from "../db/index.js"
import type { AiProxyClient } from "@openzerg/common"

const MAX_TOOL_ITERATIONS = 50

export class AgentLoop {
  private messageStore: MessageStore
  private messageBuilder: MessageBuilder
  private compaction: Compaction
  private providerResolver: ProviderResolver
  private toolManager: ToolManager
  private roleCache = new Map<string, RoleConfig>()
  private previousRoleName = new Map<string, string>()

  constructor(
    private db: DB,
    private eventBus: EventBus,
    private stateManager: SessionStateManager,
    aiProxyClient: AiProxyClient | null,
  ) {
    this.messageStore = new MessageStore(db)
    this.messageBuilder = new MessageBuilder(db)
    this.providerResolver = new ProviderResolver(db, aiProxyClient)
    this.toolManager = new ToolManager(db)
    this.compaction = new Compaction(this.messageStore, stateManager, eventBus)
  }

  async chat(sessionId: string, content: string): Promise<void> {
    const state = this.stateManager.getOrCreate(sessionId)

    if (state.sessionState === "running" || state.sessionState === "compacting") {
      this.stateManager.pushPendingMessage(sessionId, content)
      return
    }

    const role = await this.loadRole(sessionId)
    const prevRole = this.previousRoleName.get(sessionId)
    const switched = prevRole !== undefined && prevRole !== role.systemPrompt

    const finalContent = switched
      ? `<system-reminder>\nYour operational mode has changed.\nPrevious role has been replaced with a new configuration.\nFollow the new system prompt and tools from now on.\n</system-reminder>\n\n${content}`
      : content

    await this.messageStore.insert(sessionId, "user", finalContent)
    this.previousRoleName.set(sessionId, role.systemPrompt)
    this.emit(sessionId, "user_message", { content })
    await this.runLoop(sessionId)

    const pending = this.stateManager.drainPendingMessages(sessionId)
    if (pending) {
      await this.chat(sessionId, pending)
    }
  }

  async switchRole(sessionId: string, roleId: string): Promise<boolean> {
    console.warn(`[agent] switchRole called on session ${sessionId} — role switching is now a Registry cold-swap operation`)
    return false
  }

  interrupt(sessionId: string): boolean {
    return this.stateManager.abort(sessionId)
  }

  async deleteMessagesFrom(sessionId: string, messageId: string): Promise<number> {
    return this.messageStore.deleteFrom(sessionId, messageId)
  }

  private async loadRole(sessionId: string): Promise<RoleConfig> {
    const cached = this.roleCache.get(sessionId)
    if (cached) return cached

    const result = await this.providerResolver.loadRole(sessionId)
    if (result.isErr()) {
      return { systemPrompt: "", maxSteps: MAX_TOOL_ITERATIONS, zcpServers: "[]", skills: "[]", extraPkgs: "[]" }
    }
    this.roleCache.set(sessionId, result.value)
    return result.value
  }

  private async buildSystemParts(sessionId: string, role: RoleConfig): Promise<SystemPromptParts> {
    const injectedContext = this.toolManager.getSystemContext(sessionId)
    const skillContext = await this.buildSkillContext(role.skills)
    const variable = [injectedContext, skillContext].filter(Boolean).join("\n\n")
    return {
      stable: role.systemPrompt,
      variable,
    }
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
        .where("slug", "in", slugs)
        .execute()

      if (rows.length === 0) return ""

      const skillEntries = rows.map(s =>
        `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`
      ).join("\n")

      return [
        "<available_skills>",
        skillEntries,
        "</available_skills>",
        "",
        "Skills are mounted read-only at /skills/<slug>/. Use the read tool to access SKILL.md and additional resources.",
      ].join("\n")
    } catch {
      return ""
    }
  }

  private async runLoop(sessionId: string): Promise<void> {
    this.stateManager.transition(sessionId, "running")
    const ac = new AbortController()
    this.stateManager.setAbortController(sessionId, ac)

    const result = await ResultAsync.fromPromise(
      this.executeLoop(sessionId, ac),
      toAppError,
    )

    result.match(
      () => {
        this.emit(sessionId, "done", {})
      },
      (err) => {
        const isAbort = err.message?.includes("aborted") || err.message?.includes("Abort")
        if (isAbort) {
          this.emit(sessionId, "interrupted", { message: "User interrupted" })
        } else {
          this.emit(sessionId, "error", { message: err.message })
        }
      },
    )

    this.stateManager.transition(sessionId, "idle")
  }

  private async executeLoop(sessionId: string, ac: AbortController): Promise<void> {
    const providerResult = await this.providerResolver.resolveProvider(sessionId)
    if (providerResult.isErr()) {
      this.emit(sessionId, "error", { message: providerResult.error.message })
      return
    }
    const provider = providerResult.value
    const llm = new LLMClient(provider)
    const role = await this.loadRole(sessionId)

    await this.toolManager.buildTools(sessionId)
    const tools = this.toolManager.getLLMTools(sessionId)
    if (tools.length > 0) {
      this.emit(sessionId, "tools_resolved", { count: tools.length, names: tools.map(t => t.function.name) })
    }

    let iterations = 0
    let hasToolCalls = true

    while (hasToolCalls) {
      if (ac.signal.aborted) {
        this.emit(sessionId, "interrupted", { message: "User interrupted" })
        return
      }

      if (iterations >= (role.maxSteps || MAX_TOOL_ITERATIONS)) {
        this.emit(sessionId, "error", {
          message: `Tool iteration limit reached (${role.maxSteps || MAX_TOOL_ITERATIONS})`,
        })
        break
      }
      iterations++

      const systemParts = await this.buildSystemParts(sessionId, role)
      const messages = await this.messageBuilder.build(sessionId, systemParts)
      const llmTools = this.toolManager.hasTools(sessionId) ? tools : undefined
      let assistantContent = ""
      let usage = { inputTokens: 0, outputTokens: 0 }
      let toolCallBuffers: Array<{ id: string; name: string; args: string }> = []

      for await (const chunk of llm.stream(messages, llmTools, ac.signal)) {
        if (ac.signal.aborted) {
          this.emit(sessionId, "interrupted", { message: "User interrupted" })
          return
        }

        switch (chunk.type) {
          case "text":
            assistantContent += chunk.content ?? ""
            this.emit(sessionId, "response", { content: chunk.content, streaming: true })
            break
          case "tool_call_end":
            toolCallBuffers.push({
              id: chunk.toolCallId!, name: chunk.toolName!, args: chunk.content ?? "",
            })
            this.emit(sessionId, "tool_call", {
              callId: chunk.toolCallId, toolName: chunk.toolName, args: chunk.content,
            })
            break
          case "usage":
            if (chunk.usage) usage = chunk.usage
            break
        }
      }

      this.emit(sessionId, "response", { content: assistantContent, streaming: false })

      await this.messageStore.insert(sessionId, "assistant", assistantContent, {
        metadata: JSON.stringify({
          toolCalls: toolCallBuffers.map(tc => ({ id: tc.id, name: tc.name })),
        }),
        tokenUsage: JSON.stringify(usage),
      })

      await this.messageStore.addTokenUsage(sessionId, usage)

      if (provider.autoCompactLength > 0) {
        const compacted = await this.compaction.autoCompact(sessionId, provider, role.systemPrompt, ac.signal)
        if (compacted) continue
      }

      if (toolCallBuffers.length === 0) {
        hasToolCalls = false
      } else {
        for (const tc of toolCallBuffers) {
          this.emit(sessionId, "tool_executing", { callId: tc.id, toolName: tc.name })
          const result = await this.toolManager.executeTool(sessionId, tc.name, tc.args)
          await this.messageStore.insert(sessionId, "tool", result.output, {
            toolCallId: tc.id, toolName: tc.name,
            metadata: JSON.stringify({ success: result.success }),
          })
          this.emit(sessionId, "tool_result", {
            callId: tc.id, toolName: tc.name,
            content: result.output, success: result.success,
          })
        }
      }
    }
  }

  private emit(sessionId: string, type: string, data: unknown): void {
    this.eventBus.emit({ sessionId, type, data })
  }
}
