import { execSync } from "node:child_process"

export class PodmanCompose {
  private projectName: string
  private composeFile: string
  private env: Record<string, string>
  private running = false

  constructor(opts: {
    projectName: string
    composeFile: string
    env?: Record<string, string>
  }) {
    this.projectName = `e2e-${opts.projectName}`
    this.composeFile = opts.composeFile
    this.env = opts.env ?? {}
  }

  async up(services: string[] = []): Promise<void> {
    const envStr = Object.entries(this.env)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")
    const svcArgs = services.length > 0 ? services.join(" ") : ""
    const cmd = `${envStr} podman-compose -p ${this.projectName} -f ${this.composeFile} up -d ${svcArgs}`
    execSync(cmd, { stdio: "pipe", timeout: 120_000 })
    this.running = true
  }

  async down(): Promise<void> {
    if (!this.running) return
    try {
      execSync(
        `podman-compose -p ${this.projectName} -f ${this.composeFile} down -v 2>/dev/null`,
        { stdio: "pipe", timeout: 60_000 },
      )
    } catch {
      try {
        execSync(
          `podman-compose -p ${this.projectName} down -v 2>/dev/null`,
          { stdio: "pipe", timeout: 60_000 },
        )
      } catch {
        // best effort
      }
    }
    this.running = false
  }

  getProjectName(): string {
    return this.projectName
  }
}

export async function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const net = await import("node:net")
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket()
        socket.setTimeout(1000)
        socket.on("connect", () => { socket.destroy(); resolve() })
        socket.on("error", () => { socket.destroy(); reject() })
        socket.on("timeout", () => { socket.destroy(); reject() })
        socket.connect(port, "127.0.0.1")
      })
      return
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`Port ${port} not ready after ${timeoutMs}ms`)
}
