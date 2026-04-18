import type { Interceptor, Transport } from "@connectrpc/connect"
import { createConnectTransport } from "@connectrpc/connect-node"

export function createNodeTransport(baseUrl: string, interceptors: Interceptor[]): Transport {
  return createConnectTransport({
    baseUrl,
    httpVersion: "1.1",
    interceptors,
  })
}
