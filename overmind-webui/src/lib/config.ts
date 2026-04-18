export interface BackendConfig {
  id: string
  url: string
  token: string
  label: string
}

const STORAGE_KEY = "openzerg-backends"
const ACTIVE_KEY = "openzerg-active-backend"

export function loadBackends(): BackendConfig[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch { return [] }
}

export function saveBackends(backends: BackendConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backends))
}

export function getActiveBackend(): BackendConfig | null {
  const id = localStorage.getItem(ACTIVE_KEY)
  if (!id) return null
  return loadBackends().find(b => b.id === id) ?? null
}

export function setActiveBackend(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id)
}

export function addBackend(cfg: BackendConfig): void {
  const backends = loadBackends()
  const idx = backends.findIndex(b => b.id === cfg.id)
  if (idx >= 0) backends[idx] = cfg
  else backends.push(cfg)
  saveBackends(backends)
  setActiveBackend(cfg.id)
}

export function removeBackend(id: string): void {
  const backends = loadBackends().filter(b => b.id !== id)
  saveBackends(backends)
  if (localStorage.getItem(ACTIVE_KEY) === id) {
    localStorage.removeItem(ACTIVE_KEY)
  }
}
