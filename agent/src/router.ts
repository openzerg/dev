import type { ConnectRouter } from "@connectrpc/connect"
import { AgentService } from "@openzerg/common/gen/agent/v1_pb.js"
import type { AgentLoop } from "./service/agent-loop.js"
import { EventBus, type SessionEvent } from "./event-bus/index.js"
import { SessionStateManager } from "./service/session-state.js"
import type { DB } from "./db/index.js"

const DONE_TYPES = new Set(["done", "error", "interrupted"])

export function createAgentRouter(
  db: DB,
  agentLoop: AgentLoop,
  eventBus: EventBus,
  stateManager: SessionStateManager,
): (router: ConnectRouter) => void {
  return (router: ConnectRouter) => {
    router.service(AgentService, {

      chat(req) {
        agentLoop.chat(req.sessionId, req.content).catch(() => {})
        return Promise.resolve({})
      },

      interrupt(req) {
        const ok = agentLoop.interrupt(req.sessionId)
        return Promise.resolve({ success: ok })
      },

      deleteMessagesFrom(req) {
        return agentLoop.deleteMessagesFrom(req.sessionId, req.messageId)
          .then(deleted => ({ deleted }))
      },

      async *subscribeSessionEvents(req) {
        const sessionId = req.sessionId
        const queue: SessionEvent[] = []
        let resolve: (() => void) | null = null

        const unsub = eventBus.on(sessionId, (event) => {
          queue.push(event)
          if (resolve) {
            resolve()
            resolve = null
          }
        })

        try {
          while (true) {
            if (queue.length > 0) {
              const event = queue.shift()!
              yield {
                type: event.type,
                data: JSON.stringify(event.data),
                sessionId: event.sessionId,
              }
              if (DONE_TYPES.has(event.type)) return
            } else {
              await new Promise<void>((r) => { resolve = r })
            }
          }
        } finally {
          unsub()
        }
      },

      health() {
        return Promise.resolve({ status: "ok" })
      },
    })
  }
}
