import { readFileSync } from "node:fs"
import type { PodSpec, PodInfo, VolumeSpec } from "./types.js"

const LIBPOD = "/v4.0.0/libpod"
const COMPAT = "/v1.44"

export interface PodClient {
  createPod(spec: PodSpec): Promise<string>
  startPod(id: string): Promise<void>
  stopPod(id: string): Promise<void>
  removePod(id: string): Promise<void>
  inspectPod(id: string): Promise<PodInfo>
  listPods(labels?: Record<string, string>): Promise<PodInfo[]>
  createVolume(name: string, spec?: Omit<VolumeSpec, "name">): Promise<void>
  removeVolume(name: string): Promise<void>
}

export class PodmanPodClient implements PodClient {
  private readonly baseUrl: string

  constructor(url?: string) {
    if (url && url.startsWith("http")) {
      this.baseUrl = url
    } else if (url) {
      this.baseUrl = `http+unix://${encodeURIComponent(url)}`
    } else {
      this.baseUrl = process.env.POD_CLIENT_URL || process.env.PODMAN_URL || "http://localhost:8080"
    }
  }

  private async libpod(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${LIBPOD}${path}`
    const resp = await fetch(url, options)
    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      throw new Error(`Libpod API error ${resp.status}: ${path} ${body}`)
    }
    return resp
  }

  private async compat(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${COMPAT}${path}`
    const resp = await fetch(url, options)
    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      throw new Error(`Docker Compat API error ${resp.status}: ${path} ${body}`)
    }
    return resp
  }

  async createPod(spec: PodSpec): Promise<string> {
    const labels = spec.labels ?? {}
    const labelQuery = Object.entries(labels).map(([k, v]) => `&label=${encodeURIComponent(`${k}=${v}`)}`).join("")

    const podResp = await this.libpod(`/pods/create?name=${encodeURIComponent(spec.name)}${labelQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: spec.name, labels }),
    })
    const podData = await podResp.json() as { Id?: string }
    const podId = podData.Id ?? ""

    for (const container of spec.containers) {
      const hostConfig: Record<string, unknown> = {}
      if (container.volumeMounts?.length) {
        hostConfig.Binds = container.volumeMounts.map(v => `${v.name}:${v.destination}`)
      }
      if (container.ports?.length) {
        hostConfig.PortBindings = Object.fromEntries(
          container.ports.map(p => [`${p.containerPort}/${p.protocol ?? "tcp"}`, [{ HostPort: String(p.hostPort ?? p.containerPort) }]])
        )
      }
      if (spec.hostMounts?.length) {
        for (const hm of spec.hostMounts) {
          const bind = hm.readOnly !== false ? `${hm.hostPath}:${hm.containerPath}:ro` : `${hm.hostPath}:${hm.containerPath}`
          hostConfig.Binds = [...(hostConfig.Binds as string[] ?? []), bind]
        }
      }

      await this.libpod(`/containers/create?name=${encodeURIComponent(container.name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: container.image,
          command: container.command,
          env: container.env ?? {},
          host_config: hostConfig,
          labels,
          pod: spec.name,
        }),
      })
    }

    return podId
  }

  async startPod(id: string): Promise<void> {
    await this.libpod(`/pods/${encodeURIComponent(id)}/start`, { method: "POST" })
  }

  async stopPod(id: string): Promise<void> {
    try {
      await this.libpod(`/pods/${encodeURIComponent(id)}/stop`, { method: "POST" })
    } catch {}
  }

  async removePod(id: string): Promise<void> {
    try {
      await this.libpod(`/pods/${encodeURIComponent(id)}?force=true`, { method: "DELETE" })
    } catch {}
  }

  async inspectPod(id: string): Promise<PodInfo> {
    try {
      const resp = await this.libpod(`/pods/${encodeURIComponent(id)}/json`)
      const data = await resp.json() as {
        Id?: string
        Name?: string
        State?: string
        Containers?: Array<{ Id?: string; Names?: string | string[]; State?: string }>
      }
      return {
        id: data.Id ?? "",
        name: (data.Name ?? "").replace(/^\//, ""),
        state: typeof data.State === "string" ? data.State.toLowerCase() : "unknown",
        containers: (data.Containers ?? []).map(c => ({
          id: c.Id ?? "",
          name: (Array.isArray(c.Names) ? c.Names[0] : typeof c.Names === "string" ? c.Names : "").replace(/^\//, ""),
          image: "",
          state: typeof c.State === "string" ? c.State.toLowerCase() : "unknown",
          status: typeof c.State === "string" ? c.State : "unknown",
        })),
      }
    } catch {
      return {
        id: "",
        name: id,
        state: "removed",
        containers: [],
      }
    }
  }

  async listPods(labels?: Record<string, string>): Promise<PodInfo[]> {
    try {
      let path = "/pods/json"
      if (labels && Object.keys(labels).length > 0) {
        path += `?filters=${encodeURIComponent(JSON.stringify({ label: Object.entries(labels).map(([k, v]) => `${k}=${v}`) }))}`
      }
      const resp = await this.libpod(path)
      const data = await resp.json() as Array<{
        Id?: string
        Name?: string
        State?: string
        Status?: string
        Containers?: Array<{ Id?: string; Names?: string | string[]; State?: string }>
      }>
      return data.map(p => ({
        id: p.Id ?? "",
        name: (p.Name ?? "").replace(/^\//, ""),
        state: (p.State ?? p.Status ?? "unknown").toLowerCase(),
        containers: (p.Containers ?? []).map(c => ({
          id: c.Id ?? "",
          name: (Array.isArray(c.Names) ? c.Names[0] : typeof c.Names === "string" ? c.Names : "").replace(/^\//, ""),
          image: "",
          state: typeof c.State === "string" ? c.State.toLowerCase() : "unknown",
          status: typeof c.State === "string" ? c.State : "unknown",
        })),
      }))
    } catch {
      return []
    }
  }

  async createVolume(name: string, _spec?: Omit<VolumeSpec, "name">): Promise<void> {
    await this.compat("/volumes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  }

  async removeVolume(name: string): Promise<void> {
    await this.compat(`/volumes/${encodeURIComponent(name)}`, { method: "DELETE" })
  }
}

export interface KubernetesClientConfig {
  apiUrl: string
  token: string
  namespace: string
  ca?: string
}

export class KubernetesClient implements PodClient {
  private readonly apiUrl: string
  private readonly token: string
  private readonly namespace: string
  private readonly tlsOptions: Record<string, string>

  constructor(config?: Partial<KubernetesClientConfig>) {
    this.apiUrl = config?.apiUrl || process.env.K8S_API_URL || "https://127.0.0.1:6443"
    this.token = config?.token || process.env.K8S_TOKEN || ""
    this.namespace = config?.namespace || process.env.K8S_NAMESPACE || "openzerg"

    this.tlsOptions = {}
    const caPath = process.env.K8S_CA_PATH
    if (caPath) {
      try {
        this.tlsOptions.ca = readFileSync(caPath, "utf-8")
      } catch {}
    }
  }

  private async k8s(path: string, options?: RequestInit & { tls?: Record<string, string> }): Promise<Response> {
    const url = `${this.apiUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> ?? {}),
    }
    const resp = await fetch(url, {
      ...options,
      headers,
      tls: Object.keys(this.tlsOptions).length > 0 ? this.tlsOptions : undefined,
    } as RequestInit)
    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      throw new Error(`K8s API error ${resp.status}: ${path} ${body}`)
    }
    return resp
  }

  private ns(): string {
    return `/api/v1/namespaces/${this.namespace}`
  }

  async createPod(spec: PodSpec): Promise<string> {
    const labels = spec.labels ?? {}

    const allVolumeMounts = spec.containers.flatMap(c => c.volumeMounts ?? [])
    const volumeNames = [...new Set(allVolumeMounts.map(vm => vm.name))]
    let volumes: Array<Record<string, unknown>> = volumeNames.map(vName => ({
      name: vName,
      persistentVolumeClaim: { claimName: vName },
    }))

    if (spec.hostMounts?.length) {
      volumes = [
        ...(volumes ?? []),
        ...spec.hostMounts.map(hm => ({
          name: `host-${hm.containerPath.replace(/\//g, "-").slice(1)}`,
          hostPath: { path: hm.hostPath, type: "Directory" as const },
        })),
      ]
    }

    const k8sPod = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: spec.name,
        labels,
      },
      spec: {
        containers: spec.containers.map(c => {
          const container: Record<string, unknown> = {
            name: c.name,
            image: c.image,
          }
          if (c.command?.length) container.command = c.command
          if (Object.keys(c.env ?? {}).length > 0) {
            container.env = Object.entries(c.env!).map(([k, v]) => ({ name: k, value: v }))
          }
          if (c.volumeMounts?.length) {
            container.volumeMounts = c.volumeMounts.map(v => ({ name: v.name, mountPath: v.destination }))
          }
          if (spec.hostMounts?.length) {
            container.volumeMounts = [
              ...(container.volumeMounts as Array<Record<string, unknown>> ?? []),
              ...spec.hostMounts.map(hm => ({
                name: `host-${hm.containerPath.replace(/\//g, "-").slice(1)}`,
                mountPath: hm.containerPath,
              })),
            ]
          }
          if (c.ports?.length) {
            container.ports = c.ports.map(p => ({ containerPort: p.containerPort, protocol: (p.protocol ?? "TCP").toUpperCase() }))
          }
          return container
        }),
        volumes: volumes.length > 0 ? volumes : undefined,
        restartPolicy: "Never",
      },
    }

    const resp = await this.k8s(`${this.ns()}/pods`, {
      method: "POST",
      body: JSON.stringify(k8sPod),
    })
    const data = await resp.json() as { metadata?: { uid?: string } }
    return data.metadata?.uid ?? spec.name
  }

  async startPod(_id: string): Promise<void> {
  }

  async stopPod(id: string): Promise<void> {
    try {
      await this.k8s(`${this.ns()}/pods/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: JSON.stringify({ propagationPolicy: "Background" }),
      })
    } catch {}
  }

  async removePod(id: string): Promise<void> {
    try {
      await this.k8s(`${this.ns()}/pods/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: JSON.stringify({ propagationPolicy: "Background" }),
      })
    } catch {}
  }

  async inspectPod(id: string): Promise<PodInfo> {
    try {
      const resp = await this.k8s(`${this.ns()}/pods/${encodeURIComponent(id)}`)
      const data = await resp.json() as {
        metadata?: { uid?: string; name?: string }
        status?: { phase?: string; containerStatuses?: Array<{ name?: string; image?: string; state?: { running?: {}; terminated?: {}; waiting?: {} } }> }
      }
      const phase = data.status?.phase ?? "Unknown"
      return {
        id: data.metadata?.uid ?? "",
        name: data.metadata?.name ?? id,
        state: phase.toLowerCase(),
        containers: (data.status?.containerStatuses ?? []).map(cs => {
          const s = cs.state ?? {}
          let cState = "waiting"
          if (s.running) cState = "running"
          else if (s.terminated) cState = "terminated"
          return {
            id: "",
            name: cs.name ?? "",
            image: cs.image ?? "",
            state: cState,
            status: cState,
          }
        }),
      }
    } catch {
      return { id: "", name: id, state: "removed", containers: [] }
    }
  }

  async listPods(labels?: Record<string, string>): Promise<PodInfo[]> {
    try {
      let path = `${this.ns()}/pods`
      if (labels && Object.keys(labels).length > 0) {
        const selector = Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(",")
        path += `?labelSelector=${encodeURIComponent(selector)}`
      }
      const resp = await this.k8s(path)
      const data = await resp.json() as {
        items?: Array<{
          metadata?: { uid?: string; name?: string }
          status?: { phase?: string }
        }>
      }
      return (data.items ?? []).map(p => ({
        id: p.metadata?.uid ?? "",
        name: p.metadata?.name ?? "",
        state: (p.status?.phase ?? "unknown").toLowerCase(),
        containers: [],
      }))
    } catch {
      return []
    }
  }

  async createVolume(name: string, spec?: Omit<VolumeSpec, "name">): Promise<void> {
    const pvc = {
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: { name },
      spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {
          requests: {
            storage: spec?.size ?? "1Gi",
          },
        },
      },
    }
    await this.k8s(`${this.ns()}/persistentvolumeclaims`, {
      method: "POST",
      body: JSON.stringify(pvc),
    })
  }

  async removeVolume(name: string): Promise<void> {
    try {
      await this.k8s(`${this.ns()}/persistentvolumeclaims/${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
    } catch {}
  }
}
