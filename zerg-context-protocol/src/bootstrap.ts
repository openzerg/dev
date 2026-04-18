import { RegistryClient } from "@openzerg/common"

export interface ZcpBootstrapConfig {
  registryUrl: string
  registryToken: string
  instanceType: string
  port: number
  publicUrl: string
  nixPkgs: string[]
  heartbeatIntervalSec?: number
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let instanceId = ""

export function getInstanceId(): string {
  return instanceId
}

export async function bootstrapZcpService(cfg: ZcpBootstrapConfig): Promise<void> {
  const client = new RegistryClient({
    baseURL: cfg.registryUrl,
    token: cfg.registryToken,
  })

  const result = await client.register({
    name: cfg.instanceType,
    instanceType: cfg.instanceType,
    ip: "0.0.0.0",
    port: cfg.port,
    publicUrl: cfg.publicUrl,
    metadata: {
      nixPkgs: JSON.stringify(cfg.nixPkgs),
    },
  })

  if (result.isErr()) {
    console.error(`[zcp-bootstrap] register failed: ${result.error.message}`)
    return
  }

  instanceId = result.value.instanceId
  console.log(`[zcp-bootstrap] registered as ${cfg.instanceType} (instanceId=${instanceId}, nixPkgs=[${cfg.nixPkgs.join(",")}])`)

  const intervalSec = cfg.heartbeatIntervalSec ?? 30
  heartbeatTimer = setInterval(async () => {
    const hb = await client.heartbeat(instanceId)
    if (hb.isErr()) {
      console.error(`[zcp-bootstrap] heartbeat failed: ${hb.error.message}`)
    }
  }, intervalSec * 1000)
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

export function aggregatePkgs(tools: { pkgs?: string[] }[]): string[] {
  const all = new Set<string>()
  for (const t of tools) {
    if (t.pkgs) {
      for (const p of t.pkgs) all.add(p)
    }
  }
  return [...all].sort()
}
