export const AGENT_PORT = parseInt(process.env.AGENT_PORT ?? "25001")
export const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:25000"
export const AI_PROXY_URL = process.env.AI_PROXY_URL ?? ""
export const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/openzerg"
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-master-key"
