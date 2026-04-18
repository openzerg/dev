export interface ContainerSpec {
  name: string
  image: string
  env: Record<string, string>
  volumes: ContainerVolume[]
  command?: string[]
  network?: string
  portMapping?: string
}

export interface ContainerVolume {
  name: string
  destination: string
}

export interface ContainerInfo {
  id: string
  name: string
  state: string
  status: string
}
