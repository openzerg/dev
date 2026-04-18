import type { DB } from "../db/index.js"
import type { LLMMessage } from "../llm/index.js"

export interface SystemPromptParts {
  stable: string
  variable: string
}

export class MessageBuilder {
  constructor(private db: DB) {}

  async build(sessionId: string, parts: SystemPromptParts): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = []

    if (parts.stable) {
      messages.push({ role: "system", content: parts.stable })
    }

    const variableParts: string[] = []
    variableParts.push(`Current date: ${new Date().toISOString()}`)
    if (parts.variable) {
      variableParts.push(parts.variable)
    }
    messages.push({ role: "system", content: variableParts.join("\n\n") })

    const rows = await this.db.selectFrom("registry_messages").selectAll()
      .where("sessionId", "=", sessionId)
      .where("compacted", "=", false)
      .orderBy("createdAt", "asc")
      .execute()

    for (const row of rows) {
      if (row.role === "user") {
        messages.push({ role: "user", content: row.content })
      } else if (row.role === "assistant") {
        const meta = JSON.parse(row.metadata || "{}")
        const tcs = meta.toolCalls as Array<{ id: string; name: string }> | undefined
        if (tcs?.length) {
          const toolMsgs = rows.filter(r => r.role === "tool" && tcs.some(tc => tc.id === r.toolCallId))
          messages.push({
            role: "assistant", content: row.content || null,
            tool_calls: toolMsgs.map(tm => ({
              id: tm.toolCallId,
              type: "function" as const,
              function: { name: tm.toolName, arguments: tm.content },
            })),
          })
        } else {
          messages.push({ role: "assistant", content: row.content })
        }
      } else if (row.role === "tool") {
        const meta = JSON.parse(row.metadata || "{}")
        if (meta.compact_summary) continue
        if (!messages.some(m => m.tool_calls?.some(tc => tc.id === row.toolCallId))) {
          messages.push({
            role: "tool", content: row.content,
            tool_call_id: row.toolCallId, name: row.toolName,
          })
        }
      } else if (row.role === "system") {
        const meta = JSON.parse(row.metadata || "{}")
        if (meta.compact_summary) {
          messages.push({ role: "system", content: row.content })
        }
      }
    }

    return messages
  }
}
