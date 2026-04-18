import type { PodmanClient } from "./podman/client.js"
import type { InfraServiceSpec, Config } from "./config.js"

export async function startInfrastructure(cfg: Config): Promise<void> {
  const podman = cfg.podman
  const network = cfg.podmanNetwork

  await podman.ensureNetwork(network)
  console.log(`[infra] network "${network}" ready`)

  for (const svc of cfg.infraServices) {
    await ensureService(podman, svc, network)
  }

  console.log(`[infra] all ${cfg.infraServices.length} services started`)
}

export async function stopInfrastructure(cfg: Config): Promise<void> {
  const podman = cfg.podman

  for (const svc of cfg.infraServices) {
    try {
      await podman.stopContainer(svc.containerName)
      await podman.removeContainer(svc.containerName)
      console.log(`[infra] stopped ${svc.name}`)
    } catch {
      // may already be gone
    }
  }

  console.log("[infra] all services stopped")
}

async function ensureService(podman: PodmanClient, svc: InfraServiceSpec, network: string): Promise<void> {
  try {
    const info = await podman.inspectContainer(svc.containerName)
    if (info.state === "running") {
      console.log(`[infra] ${svc.name} already running`)
      return
    }
    await podman.removeContainer(svc.containerName)
  } catch {
    // container doesn't exist, that's fine
  }

  for (const vol of svc.volumes ?? []) {
    try {
      await podman.createVolume(vol.name)
    } catch {
      // volume may already exist
    }
  }

  await podman.createContainer({
    name: svc.containerName,
    image: svc.image,
    env: svc.env,
    volumes: svc.volumes ?? [],
    network,
    portMapping: svc.portMapping,
  })

  await podman.startContainer(svc.containerName)
  console.log(`[infra] started ${svc.name} (${svc.containerName})`)
}
