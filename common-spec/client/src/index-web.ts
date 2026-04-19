import { setDefaultTransport } from "./common.js"
import { createWebTransport } from "./transport-web.js"

setDefaultTransport(createWebTransport)

export { RegistryClient } from "./registry.js"
export { AgentClient } from "./agent.js"
export { AiProxyClient } from "./ai-proxy.js"
export { WorkerClient } from "./worker.js"
export { ToolServiceClient, ToolRouter } from "./tool-service.js"
export { SkillManagerClient } from "./skill-manager.js"
export { WorkspaceManagerClient } from "./workspace-manager.js"
export { ToolServerManagerClient } from "./tool-server-manager.js"
export { createWebTransport } from "./transport-web.js"
export { createAuthInterceptor, createSessionInterceptor } from "./common.js"
export type { ClientOptions, TransportFactory } from "./common.js"
export {
  AppError, NotFoundError, ValidationError, DbError, UpstreamError,
  PermissionError, ConflictError, UnauthenticatedError, InternalError,
  errorToStatus, toAppError,
} from "./errors.js"
