export function createMockPodman() {
  const containers = new Map<string, { running: boolean }>()
  const volumes = new Set<string>()
  const networks = new Set<string>()

  return {
    async createContainer(spec: { name: string; image: string; env: Record<string, string>; volumes: Array<{ name: string; destination: string }>; command?: string[]; network?: string; portMapping?: string }): Promise<string> {
      const id = `mock-${spec.name}`
      containers.set(spec.name, { running: false })
      return id
    },
    async startContainer(nameOrId: string): Promise<void> {
      const c = containers.get(nameOrId)
      if (c) c.running = true
    },
    async stopContainer(nameOrId: string): Promise<void> {
      const c = containers.get(nameOrId)
      if (c) c.running = false
    },
    async removeContainer(nameOrId: string): Promise<void> {
      containers.delete(nameOrId)
    },
    async inspectContainer(nameOrId: string): Promise<{ id: string; name: string; state: string; status: string }> {
      const c = containers.get(nameOrId)
      return {
        id: nameOrId,
        name: nameOrId,
        state: c?.running ? "running" : "stopped",
        status: c?.running ? "running" : "stopped",
      }
    },
    async listContainers(): Promise<Array<{ id: string; name: string; state: string; status: string }>> {
      return [...containers.entries()].map(([name, info]) => ({
        id: name, name, state: info.running ? "running" : "stopped", status: info.running ? "running" : "stopped",
      }))
    },
    async createVolume(name: string): Promise<void> {
      volumes.add(name)
    },
    async removeVolume(name: string): Promise<void> {
      volumes.delete(name)
    },
    async ensureNetwork(name: string): Promise<void> {
      networks.add(name)
    },
    async connectContainerToNetwork(): Promise<void> {},
    getVolumeNames(): string[] {
      return [...volumes]
    },
  }
}
