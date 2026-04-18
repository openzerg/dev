export type SessionState = "idle" | "running" | "compacting"

export interface SessionRuntimeState {
  sessionState: SessionState
  abortController: AbortController | null
  pendingMessages: string[]
}

const DEFAULT: SessionRuntimeState = {
  sessionState: "idle",
  abortController: null,
  pendingMessages: [],
}

export class SessionStateManager {
  private states = new Map<string, SessionRuntimeState>()

  getOrCreate(sessionId: string): SessionRuntimeState {
    let state = this.states.get(sessionId)
    if (!state) {
      state = { ...DEFAULT, pendingMessages: [] }
      this.states.set(sessionId, state)
    }
    return state
  }

  transition(sessionId: string, newState: SessionState): void {
    const state = this.getOrCreate(sessionId)
    state.sessionState = newState
    if (newState === "idle" || newState === "running") {
      if (newState === "idle") {
        state.abortController = null
      }
    }
  }

  setAbortController(sessionId: string, ac: AbortController): void {
    this.getOrCreate(sessionId).abortController = ac
  }

  abort(sessionId: string): boolean {
    const state = this.states.get(sessionId)
    if (state?.abortController) {
      state.abortController.abort()
      state.abortController = null
      return true
    }
    return false
  }

  pushPendingMessage(sessionId: string, content: string): void {
    this.getOrCreate(sessionId).pendingMessages.push(content)
  }

  drainPendingMessages(sessionId: string): string | null {
    const state = this.states.get(sessionId)
    if (!state || state.pendingMessages.length === 0) return null
    const messages = state.pendingMessages.join("\n\n---\n\n")
    state.pendingMessages = []
    return messages
  }

  getState(sessionId: string): SessionState {
    return this.getOrCreate(sessionId).sessionState
  }

  cleanup(sessionId: string): void {
    const state = this.states.get(sessionId)
    if (state) {
      state.abortController?.abort()
      this.states.delete(sessionId)
    }
  }
}
