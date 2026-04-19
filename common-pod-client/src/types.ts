export interface PodSpec {
  name: string
  namespace?: string
  labels?: Record<string, string>
  containers: ContainerSpec[]
  volumes?: VolumeSpec[]
  hostMounts?: HostMount[]
}

export interface ContainerSpec {
  name: string
  image: string
  command?: string[]
  env?: Record<string, string>
  volumeMounts?: VolumeMount[]
  ports?: PortMapping[]
  resources?: ResourceLimits
}

export interface VolumeMount {
  name: string
  destination: string
}

export interface HostMount {
  hostPath: string
  containerPath: string
  readOnly?: boolean
}

export interface PortMapping {
  containerPort: number
  hostPort?: number
  protocol?: string
}

export interface ResourceLimits {
  cpu?: string
  memory?: string
}

export interface VolumeSpec {
  name: string
  persistent?: boolean
  size?: string
}

export interface PodInfo {
  id: string
  name: string
  state: string
  containers: ContainerInfo[]
}

export interface ContainerInfo {
  id: string
  name: string
  image: string
  state: string
  status: string
}
