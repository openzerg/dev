import type { ContainerSpec, ContainerInfo } from "./types.js"

export class PodmanClient {
  private readonly baseUrl: string

  constructor(socketPath?: string) {
    this.baseUrl = socketPath
      ? `http+unix://${encodeURIComponent(socketPath)}`
      : "http://localhost:8080"
  }

  private async request(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const resp = await fetch(url, options)
    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      throw new Error(`Podman API error ${resp.status}: ${path} ${body}`)
    }
    return resp
  }

  async createContainer(spec: ContainerSpec): Promise<string> {
    const hostConfig: Record<string, unknown> = {
      Binds: spec.volumes.map(v => `${v.name}:${v.destination}`),
      RestartPolicy: { Name: "unless-stopped" },
    }

    if (spec.portMapping) {
      hostConfig.PortBindings = {
        [spec.portMapping.split(":")[1] + "/tcp"]: [{ HostPort: spec.portMapping.split(":")[0] }],
      }
    }

    const body: Record<string, unknown> = {
      name: spec.name,
      image: spec.image,
      Env: Object.entries(spec.env).map(([k, v]) => `${k}=${v}`),
      Cmd: spec.command,
      HostConfig: hostConfig,
    }

    if (spec.network) {
      body.NetworkingConfig = { EndpointsConfig: { [spec.network]: {} } }
    }

    const resp = await this.request("/v1.0.0/containers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await resp.json() as { Id?: string; Warnings?: string[] }
    if (data.Warnings?.length) {
      console.warn(`[podman] create warnings for ${spec.name}:`, data.Warnings)
    }
    return data.Id ?? ""
  }

  async startContainer(nameOrId: string): Promise<void> {
    await this.request(`/v1.0.0/containers/${nameOrId}/start`, { method: "POST" })
  }

  async stopContainer(nameOrId: string): Promise<void> {
    await this.request(`/v1.0.0/containers/${nameOrId}/stop`, { method: "POST" })
  }

  async removeContainer(nameOrId: string): Promise<void> {
    await this.request(`/v1.0.0/containers/${nameOrId}?force=true`, { method: "DELETE" })
  }

  async inspectContainer(nameOrId: string): Promise<ContainerInfo> {
    const resp = await this.request(`/v1.0.0/containers/${nameOrId}/json`)
    const data = await resp.json() as { Id?: string; Name?: string; State?: { Status?: string; Running?: boolean } }
    return {
      id: data.Id ?? "",
      name: data.Name ?? "",
      state: data.State?.Running ? "running" : "stopped",
      status: data.State?.Status ?? "unknown",
    }
  }

  async listContainers(filters?: Record<string, string[]>): Promise<ContainerInfo[]> {
    let path = "/v1.0.0/containers/json?all=true"
    if (filters) {
      path += `&filters=${encodeURIComponent(JSON.stringify(filters))}`
    }
    const resp = await this.request(path)
    const data = await resp.json() as Array<{ Id?: string; Names?: string[]; State?: string; Status?: string }>
    return data.map(c => ({
      id: c.Id ?? "",
      name: (c.Names?.[0] ?? "").replace(/^\//, ""),
      state: c.State ?? "unknown",
      status: c.Status ?? "unknown",
    }))
  }

  async createVolume(name: string): Promise<void> {
    await this.request("/v1.0.0/volumes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  }

  async removeVolume(name: string): Promise<void> {
    await this.request(`/v1.0.0/volumes/${name}`, { method: "DELETE" })
  }

  async ensureNetwork(name: string): Promise<void> {
    try {
      await this.request(`/v1.0.0/networks/${name}`)
    } catch {
      await this.request("/v1.0.0/networks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, driver: "bridge" }),
      })
      console.log(`[podman] created network ${name}`)
    }
  }

  async connectContainerToNetwork(network: string, container: string): Promise<void> {
    await this.request(`/v1.0.0/networks/${network}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ container }),
    })
  }
}
