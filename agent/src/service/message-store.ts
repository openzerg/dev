import type { DB } from "../db/index.js"
import { randomUUID } from "node:crypto"

export class MessageStore {
  constructor(private db: DB) {}

  async insert(
    sessionId: string, role: string, content: string,
    opts?: { parentMessageId?: string; toolCallId?: string; toolName?: string; tokenUsage?: string; metadata?: string },
  ): Promise<string> {
    const id = randomUUID()
    await this.db.insertInto("registry_messages").values({
      id, sessionId, role, content,
      parentMessageId: opts?.parentMessageId ?? "",
      toolCallId: opts?.toolCallId ?? "",
      toolName: opts?.toolName ?? "",
      tokenUsage: opts?.tokenUsage ?? "{}",
      metadata: opts?.metadata ?? "{}",
      compacted: false,
      createdAt: BigInt(Date.now()),
    }).execute()
    return id
  }

  async addTokenUsage(sessionId: string, usage: { inputTokens: number; outputTokens: number }): Promise<void> {
    const session = await this.db.selectFrom("registry_sessions").select(["inputTokens", "outputTokens"])
      .where("id", "=", sessionId).executeTakeFirst()
    if (!session) return
    await this.db.updateTable("registry_sessions").set({
      inputTokens: BigInt(Number(session.inputTokens) + usage.inputTokens),
      outputTokens: BigInt(Number(session.outputTokens) + usage.outputTokens),
      updatedAt: BigInt(Date.now()),
    }).where("id", "=", sessionId).execute()
  }

  async deleteFrom(sessionId: string, messageId: string): Promise<number> {
    const msg = await this.db.selectFrom("registry_messages").select(["createdAt"])
      .where("id", "=", messageId)
      .where("sessionId", "=", sessionId)
      .executeTakeFirst()
    if (!msg) return 0
    const result = await this.db.deleteFrom("registry_messages")
      .where("sessionId", "=", sessionId)
      .where("createdAt", ">=", msg.createdAt)
      .executeTakeFirst()
    return Number(result.numDeletedRows ?? 0)
  }

  async listUncompacted(sessionId: string): Promise<any[]> {
    return this.db.selectFrom("registry_messages").selectAll()
      .where("sessionId", "=", sessionId)
      .where("compacted", "=", false)
      .orderBy("createdAt", "asc")
      .execute()
  }

  async listToolMessagesUncompacted(sessionId: string): Promise<any[]> {
    return this.db.selectFrom("registry_messages").selectAll()
      .where("sessionId", "=", sessionId)
      .where("role", "=", "tool")
      .where("compacted", "=", false)
      .orderBy("createdAt", "desc")
      .execute()
  }

  async markCompacted(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.db.updateTable("registry_messages").set({ compacted: true })
      .where("id", "in", ids).execute()
  }

  async compactAllNonSystem(sessionId: string): Promise<void> {
    await this.db.updateTable("registry_messages").set({ compacted: true })
      .where("sessionId", "=", sessionId)
      .where("compacted", "=", false)
      .where("role", "!=", "system")
      .execute()
  }

  async unmarkCompactSummaries(sessionId: string): Promise<void> {
    await this.db.updateTable("registry_messages").set({ compacted: false })
      .where("sessionId", "=", sessionId)
      .where("metadata", "like", "%compact_summary%")
      .execute()
  }

  async resetSessionTokens(sessionId: string, factor: number): Promise<void> {
    const session = await this.db.selectFrom("registry_sessions").select(["inputTokens"])
      .where("id", "=", sessionId).executeTakeFirst()
    if (!session) return
    await this.db.updateTable("registry_sessions").set({
      inputTokens: BigInt(Math.floor(Number(session.inputTokens) * factor)),
      updatedAt: BigInt(Date.now()),
    }).where("id", "=", sessionId).execute()
  }

  async getSessionInputTokens(sessionId: string): Promise<number> {
    const s = await this.db.selectFrom("registry_sessions").select(["inputTokens"])
      .where("id", "=", sessionId).executeTakeFirst()
    return Number(s?.inputTokens ?? 0)
  }
}
