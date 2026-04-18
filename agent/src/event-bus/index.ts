type EventHandler = (event: SessionEvent) => void

export type SessionEvent = {
  sessionId: string
  type: string
  data: unknown
}

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>()

  on(sessionId: string, handler: EventHandler): () => void {
    if (!this.handlers.has(sessionId)) {
      this.handlers.set(sessionId, new Set())
    }
    this.handlers.get(sessionId)!.add(handler)
    return () => this.handlers.get(sessionId)?.delete(handler)
  }

  emit(event: SessionEvent): void {
    const sessionHandlers = this.handlers.get(event.sessionId)
    if (sessionHandlers) {
      for (const h of sessionHandlers) h(event)
    }
  }

  removeSession(sessionId: string): void {
    this.handlers.delete(sessionId)
  }
}
