import { ResultAsync } from "neverthrow"
import { toAppError } from "@openzerg/common"
import { LLMClient } from "../llm/index.js"
import type { ProviderConfig } from "./provider-resolver.js"
import { MessageStore } from "./message-store.js"
import { SessionStateManager } from "./session-state.js"
import { EventBus } from "../event-bus/index.js"

const COMPACTION_BUFFER = 20_000
const PRUNE_PROTECT = 40_000
const PRUNE_MINIMUM = 20_000

export class Compaction {
  constructor(
    private messageStore: MessageStore,
    private stateManager: SessionStateManager,
    private eventBus: EventBus,
  ) {}

  async autoCompact(
    sessionId: string,
    provider: ProviderConfig,
    systemPrompt: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    const totalTokens = await this.messageStore.getSessionInputTokens(sessionId)
    const reserved = Math.min(COMPACTION_BUFFER, provider.maxTokens || 4096)
    const usable = provider.autoCompactLength - reserved
    if (usable <= 0 || totalTokens < usable) return false

    const pruned = await this.prune(sessionId)
    if (pruned) return true

    return this.compactSummarize(sessionId, provider, systemPrompt, signal)
  }

  private async prune(sessionId: string): Promise<boolean> {
    const toolMessages = await this.messageStore.listToolMessagesUncompacted(sessionId)

    let total = 0
    const toPrune: string[] = []

    for (const msg of toolMessages) {
      const estimate = Math.ceil((msg.content?.length ?? 0) / 4)
      total += estimate
      if (total > PRUNE_PROTECT) {
        toPrune.push(msg.id)
      }
    }

    if (toPrune.length === 0) return false

    let prunedTokens = 0
    for (const id of toPrune) {
      const msg = toolMessages.find(m => m.id === id)!
      prunedTokens += Math.ceil((msg.content?.length ?? 0) / 4)
    }

    if (prunedTokens < PRUNE_MINIMUM) return false

    await this.messageStore.markCompacted(toPrune)
    this.emit(sessionId, "pruned", { count: toPrune.length, tokens: prunedTokens })
    return true
  }

  private compactSummarize(
    sessionId: string,
    provider: ProviderConfig,
    _systemPrompt: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    this.stateManager.transition(sessionId, "compacting")
    this.emit(sessionId, "compacting", {})

    return ResultAsync.fromPromise(
      this.doCompactSummarize(sessionId, provider, signal),
      toAppError,
    ).match<boolean>(
      (result) => {
        this.stateManager.transition(sessionId, "running")
        return result
      },
      (err) => {
        this.emit(sessionId, "error", { message: `Auto-compaction failed: ${err.message}` })
        this.stateManager.transition(sessionId, "running")
        return false
      },
    )
  }

  private async doCompactSummarize(
    sessionId: string,
    provider: ProviderConfig,
    signal: AbortSignal,
  ): Promise<boolean> {
    const messages = await this.messageStore.listUncompacted(sessionId)

    if (messages.length <= 10) {
      this.stateManager.transition(sessionId, "running")
      return false
    }

    const historyText = messages.map(m => `${m.role}: ${m.content}`).join("\n\n")
    const summaryPrompt = `Provide a detailed prompt for continuing our conversation above.
Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.
The summary that you construct will be used so that another agent can read it and continue the work.

When constructing the summary, try to stick to this template:
---
## Goal

[What goal(s) is the user trying to accomplish?]

## Instructions

- [What important instructions did the user give you that are relevant]
- [If there is a plan or spec, include information about it so next agent can continue using it]

## Discoveries

[What notable things were learned during this conversation that would be useful for the next agent to know when continuing the work]

## Accomplished

[What work has been completed, what work is still in progress, and what work is left?]

## Relevant files / directories

[Construct a structured list of relevant files that have been read, edited, or created that pertain to the task at hand. If all the files in a directory are relevant, include the path to the directory.]
---`

    const llm = new LLMClient(provider)
    const summary = await llm.complete([
      { role: "system", content: "You are a helpful assistant that summarizes conversations concisely while preserving all important information." },
      { role: "user", content: historyText },
      { role: "user", content: summaryPrompt },
    ], signal)

    await this.messageStore.insert(sessionId, "system",
      `[Conversation summary: ${summary}]\n\nThis summary covers ${messages.length} messages from the earlier conversation.`,
      { metadata: JSON.stringify({ compact_summary: true }) },
    )

    await this.messageStore.compactAllNonSystem(sessionId)
    await this.messageStore.unmarkCompactSummaries(sessionId)
    await this.messageStore.resetSessionTokens(sessionId, 0.1)

    this.emit(sessionId, "compacted", {
      compactedCount: messages.length,
      newInputTokens: await this.messageStore.getSessionInputTokens(sessionId),
    })
    return true
  }

  private emit(sessionId: string, type: string, data: unknown): void {
    this.eventBus.emit({ sessionId, type, data })
  }
}
