import {
  RegistryClient,
  AgentClient,
  SkillManagerClient,
  AiProxyClient,
  createWebTransport,
  createAuthInterceptor,
} from "@openzerg/common"
import type { BackendConfig } from "./config"

let registryClient: RegistryClient | null = null
let agentClient: AgentClient | null = null
let skillClient: SkillManagerClient | null = null
let aiProxyClient: AiProxyClient | null = null

export function initializeClients(backend: BackendConfig): void {
  const transport = (baseUrl: string) =>
    createWebTransport(baseUrl, [createAuthInterceptor(() => backend.token)])

  registryClient = new RegistryClient({ baseURL: backend.url, token: backend.token, transport })
  agentClient = new AgentClient({ baseURL: `${backend.url}/api/agent`, token: backend.token, transport })
  skillClient = new SkillManagerClient({ baseURL: `${backend.url}/api/skills`, token: backend.token, transport })
  aiProxyClient = new AiProxyClient({ baseURL: `${backend.url}/api/ai-proxy`, token: backend.token, transport })
}

export function getRegistry(): RegistryClient {
  if (!registryClient) throw new Error("Registry client not initialized")
  return registryClient
}

export function getAgent(): AgentClient {
  if (!agentClient) throw new Error("Agent client not initialized")
  return agentClient
}

export function getSkillManager(): SkillManagerClient {
  if (!skillClient) throw new Error("SkillManager client not initialized")
  return skillClient
}

export function getAiProxy(): AiProxyClient {
  if (!aiProxyClient) throw new Error("AiProxy client not initialized")
  return aiProxyClient
}

export function isInitialized(): boolean {
  return registryClient !== null
}

export function resetClients(): void {
  registryClient = null
  agentClient = null
  skillClient = null
  aiProxyClient = null
}
