import { describe, test, expect } from "bun:test"
import { InstanceSchema } from "../generated/ts/entities/instance-schema.js"
import { SessionSchema } from "../generated/ts/entities/session-schema.js"
import { WorkspaceSchema } from "../generated/ts/entities/workspace-schema.js"
import { WorkerSchema } from "../generated/ts/entities/worker-schema.js"
import { ProviderModelConfigSchema } from "../generated/ts/entities/providermodelconfig-schema.js"
import { ProxySchema } from "../generated/ts/entities/proxy-schema.js"
import { LogSchema } from "../generated/ts/entities/log-schema.js"

function ts(): bigint {
  return BigInt(Math.floor(Date.now() / 1000))
}

describe("Instance entity", () => {
  test("valid round-trip", () => {
    const data = {
      id: "inst-1",
      name: "test-instance",
      instanceType: "zcp-fs",
      ip: "127.0.0.1",
      port: 25010,
      publicUrl: "http://localhost:25010",
      lifecycle: "active",
      lastSeen: ts(),
      metadata: {},
      createdAt: ts(),
      updatedAt: ts(),
    }
    const parsed = InstanceSchema.safeParse(data)
    expect(parsed.success).toBe(true)
  })

  test("rejects missing required fields", () => {
    const parsed = InstanceSchema.safeParse({ id: "x" })
    expect(parsed.success).toBe(false)
  })
})

describe("Worker entity", () => {
  test("valid round-trip with secret", () => {
    const data = {
      id: "worker-1",
      name: "test-worker",
      containerName: "worker-test-worker",
      image: "worker:latest",
      secret: "uuid-secret-here",
      lifecycle: "running",
      workspaceRoot: "/data/workspace",
      filesystemUrl: "http://zcp-fs:25010",
      executionUrl: "http://zcp-job:25011",
      createdAt: ts(),
      updatedAt: ts(),
    }
    const parsed = WorkerSchema.safeParse(data)
    expect(parsed.success).toBe(true)
  })
})

describe("Session entity", () => {
  test("valid round-trip", () => {
    const data = {
      id: "sess-1",
      title: "test session",
      workerId: "worker-1",
      agentId: "agent-1",
      roleId: "role-default",
      sessionToken: "st-abc123",
      state: "active",
      workspaceId: "ws-1",
      inputTokens: 0n,
      outputTokens: 0n,
      lastActiveAt: 0n,
      createdAt: ts(),
      updatedAt: ts(),
    }
    const parsed = SessionSchema.safeParse(data)
    expect(parsed.success).toBe(true)
  })
})

describe("Workspace entity", () => {
  test("valid round-trip", () => {
    const data = {
      id: "ws-1",
      volumeName: "ws-abc123",
      state: "active",
      boundSessionId: "sess-1",
      createdAt: ts(),
      updatedAt: ts(),
    }
    const parsed = WorkspaceSchema.safeParse(data)
    expect(parsed.success).toBe(true)
  })
})

describe("ProviderModelConfig entity", () => {
  test("valid round-trip", () => {
    const data = {
      id: "pmc-1",
      providerId: "openai",
      providerName: "OpenAI",
      modelId: "gpt-4o",
      modelName: "GPT-4o",
      upstream: "https://api.openai.com/v1",
      apiKey: "sk-test",
      supportStreaming: true,
      supportTools: true,
      supportVision: true,
      supportReasoning: false,
      defaultMaxTokens: 4096,
      contextLength: 128000,
      autoCompactLength: 100000,
      enabled: true,
      createdAt: ts(),
      updatedAt: ts(),
    }
    const parsed = ProviderModelConfigSchema.safeParse(data)
    expect(parsed.success).toBe(true)
  })
})

describe("Log entity", () => {
  test("valid round-trip", () => {
    const data = {
      id: "log-1",
      proxyId: "proxy-1",
      sourceModel: "my-gpt-4o",
      targetModel: "gpt-4o",
      upstream: "https://api.openai.com/v1",
      inputTokens: 100n,
      outputTokens: 50n,
      totalTokens: 150n,
      durationMs: 2000n,
      timeToFirstTokenMs: 500n,
      isStream: true,
      isSuccess: true,
      errorMessage: "",
      createdAt: ts(),
    }
    const parsed = LogSchema.safeParse(data)
    expect(parsed.success).toBe(true)
  })
})

describe("Proxy entity", () => {
  test("valid round-trip", () => {
    const data = {
      id: "proxy-1",
      sourceModel: "my-gpt-4o",
      providerModelConfigId: "pmc-1",
      apiKey: "generated-key",
      enabled: true,
      createdAt: ts(),
      updatedAt: ts(),
    }
    const parsed = ProxySchema.safeParse(data)
    expect(parsed.success).toBe(true)
  })
})
