import type { Interceptor, Transport } from "@connectrpc/connect"

export function createAuthInterceptor(getToken: () => string): Interceptor {
  return (next) => async (req) => {
    const token = getToken()
    if (token) {
      req.header.set("Authorization", `Bearer ${token}`)
    }
    return next(req)
  }
}

export function createSessionInterceptor(getSessionId: () => string | undefined): Interceptor {
  return (next) => async (req) => {
    const sessionId = getSessionId()
    if (sessionId) {
      req.header.set("X-Session-Id", sessionId)
    }
    return next(req)
  }
}

export type TransportFactory = (baseUrl: string, interceptors: Interceptor[]) => Transport

export interface ClientOptions {
  baseURL: string
  token?: string
  transport?: TransportFactory
}

export let defaultTransport: TransportFactory = () => {
  throw new Error("defaultTransport not set — import from @openzerg/common (node) or @openzerg/common/web")
}

export function setDefaultTransport(factory: TransportFactory): void {
  defaultTransport = factory
}

export abstract class BaseClient {
  protected token: string
  protected readonly transport: Transport

  constructor(opts: ClientOptions) {
    this.token = opts.token ?? ""
    const factory = opts.transport ?? defaultTransport
    this.transport = factory(opts.baseURL, [
      createAuthInterceptor(() => this.token),
    ])
  }

  setToken(token: string): void {
    this.token = token
  }

  getToken(): string {
    return this.token
  }
}
