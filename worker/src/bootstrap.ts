import { RegistryClient } from "@openzerg/common"
import { ResultAsync } from "neverthrow"

export interface BootstrapConfig {
  registryUrl: string
  registryToken: string
  workerName: string
  port: number
  heartbeatIntervalSec: number
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let instanceId = ""

export function getInstanceId(): string {
  return instanceId
}

export async function bootstrap(cfg: BootstrapConfig): Promise<void> {
  const client = new RegistryClient({
    baseURL: cfg.registryUrl,
    token: cfg.registryToken,
  })

  const result = await client.register({
    name: cfg.workerName,
    instanceType: "worker",
    ip: "0.0.0.0",
    port: cfg.port,
    publicUrl: `http://${cfg.workerName}:${cfg.port}`,
  })

  if (result.isErr()) {
    console.error(`[worker-bootstrap] register failed: ${result.error.message}`)
    return
  }

  instanceId = result.value.instanceId
  console.log(`[worker-bootstrap] registered as ${cfg.workerName} (instanceId=${instanceId})`)

  heartbeatTimer = setInterval(async () => {
    const hb = await client.heartbeat(instanceId)
    if (hb.isErr()) {
      console.error(`[worker-bootstrap] heartbeat failed: ${hb.error.message}`)
    }
  }, cfg.heartbeatIntervalSec * 1000)
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}
