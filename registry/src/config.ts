import { PodmanClient } from "./podman/client.js"

export interface InfraServiceSpec {
  name: string
  image: string
  containerName: string
  env: Record<string, string>
  volumes?: Array<{ name: string; destination: string }>
  portMapping?: string
}

export function loadConfig() {
  const pgUser = process.env.POSTGRES_USER ?? "openzerg"
  const pgPass = process.env.POSTGRES_PASSWORD ?? "openzerg"
  const pgDb = process.env.POSTGRES_DB ?? "openzerg"
  const pgHost = process.env.POSTGRES_HOST ?? "postgres"
  const pgPort = process.env.POSTGRES_PORT ?? "5432"
  const databaseURL = process.env.DATABASE_URL
    ?? `postgresql://${pgUser}:${pgPass}@${pgHost}:${pgPort}/${pgDb}`
  const registryURL = process.env.REGISTRY_INTERNAL_URL ?? "http://registry:25000"
  const registryToken = process.env.ZCP_SERVICE_TOKEN ?? ""
  const podmanNetwork = process.env.PODMAN_NETWORK ?? "openzerg"

  const infraServices: InfraServiceSpec[] = [
    {
      name: "ai-proxy",
      image: process.env.IMAGE_AI_PROXY ?? "localhost/openzerg/ai-proxy:latest",
      containerName: "uz-ai-proxy",
      env: {
        DATABASE_URL: databaseURL,
        AI_PROXY_PORT: process.env.AI_PROXY_PORT ?? "15316",
        AI_PROXY_HOST: "0.0.0.0",
        REGISTRY_URL: registryURL,
        ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? "",
        HOST_IP: process.env.HOST_IP ?? "127.0.0.1",
      },
      portMapping: `${process.env.AI_PROXY_PORT ?? "15316"}:15316`,
    },
    {
      name: "zcp-fs",
      image: process.env.IMAGE_ZCP_FS ?? "localhost/openzerg/zcp-fs:latest",
      containerName: "uz-zcp-fs",
      env: {
        PORT: "25010",
        REGISTRY_URL: registryURL,
        REGISTRY_TOKEN: registryToken,
        PUBLIC_URL: "http://uz-zcp-fs:25010",
      },
      portMapping: "25010:25010",
    },
    {
      name: "zcp-job",
      image: process.env.IMAGE_ZCP_JOB ?? "localhost/openzerg/zcp-job:latest",
      containerName: "uz-zcp-job",
      env: {
        PORT: "25011",
        REGISTRY_URL: registryURL,
        REGISTRY_TOKEN: registryToken,
        PUBLIC_URL: "http://uz-zcp-job:25011",
      },
      portMapping: "25011:25011",
    },
    {
      name: "zcp-memory",
      image: process.env.IMAGE_ZCP_MEMORY ?? "localhost/openzerg/zcp-memory:latest",
      containerName: "uz-zcp-memory",
      env: {
        PORT: "25030",
        DATABASE_URL: databaseURL,
        REGISTRY_URL: registryURL,
        REGISTRY_TOKEN: registryToken,
        PUBLIC_URL: "http://uz-zcp-memory:25030",
      },
      portMapping: "25030:25030",
    },
    {
      name: "zcp-web",
      image: process.env.IMAGE_ZCP_WEB ?? "localhost/openzerg/zcp-web:latest",
      containerName: "uz-zcp-web",
      env: {
        PORT: "25031",
        REGISTRY_URL: registryURL,
        REGISTRY_TOKEN: registryToken,
        PUBLIC_URL: "http://uz-zcp-web:25031",
      },
      portMapping: "25031:25031",
    },
    {
      name: "skill-manager",
      image: process.env.IMAGE_SKILL_MANAGER ?? "localhost/openzerg/skill-manager:latest",
      containerName: "uz-skill-manager",
      env: {
        DATABASE_URL: databaseURL,
        PORT: "15345",
        SKILLS_DIR: "/data/skills",
      },
      volumes: [{ name: "uz-skills", destination: "/data/skills" }],
      portMapping: "15345:15345",
    },
    {
      name: "agent",
      image: process.env.IMAGE_AGENT ?? "localhost/openzerg/agent:latest",
      containerName: "uz-agent",
      env: {
        DATABASE_URL: databaseURL,
        PORT: "25100",
        REGISTRY_URL: registryURL,
      },
      portMapping: "25100:25100",
    },
  ]

  return {
    port: parseInt(process.env.PORT ?? "25000", 10),
    databaseURL,
    jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    workerImage: process.env.WORKER_IMAGE ?? "localhost/openzerg/worker:latest",
    podmanSocket: process.env.PODMAN_SOCKET ?? "/run/podman/podman.sock",
    idleTimeoutSec: parseInt(process.env.IDLE_TIMEOUT_SEC ?? "3600", 10),
    podmanNetwork,
    infraServices,
    podman: new PodmanClient(process.env.PODMAN_SOCKET),
  }
}

export type Config = ReturnType<typeof loadConfig>
