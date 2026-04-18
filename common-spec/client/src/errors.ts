/**
 * OpenZergUltra 语义化错误类型
 *
 * 所有服务共享此错误体系。
 * 配合 neverthrow 的 Result<T, AppError> 使用，
 * 消灭隐式 throw/catch，错误类型在函数签名中可见。
 */

// ── 基础类 ─────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

// ── 具体错误类型 ───────────────────────────────────────────────────────────────

/** 资源不存在（HTTP 404） */
export class NotFoundError extends AppError {
  constructor(message: string) { super(message, "NOT_FOUND") }
}

/** 请求参数不合法（HTTP 400） */
export class ValidationError extends AppError {
  constructor(message: string) { super(message, "VALIDATION") }
}

/** 数据库操作失败（HTTP 500） */
export class DbError extends AppError {
  constructor(message: string) { super(message, "DB_ERROR") }
}

/** 上游服务调用失败（HTTP 502） */
export class UpstreamError extends AppError {
  constructor(message: string, public readonly upstream?: string) {
    super(message, "UPSTREAM_ERROR")
  }
}

/** 权限不足（HTTP 403） */
export class PermissionError extends AppError {
  constructor(message: string) { super(message, "PERMISSION_DENIED") }
}

/** 资源冲突（HTTP 409） */
export class ConflictError extends AppError {
  constructor(message: string) { super(message, "CONFLICT") }
}

/** 认证失败（HTTP 401） */
export class UnauthenticatedError extends AppError {
  constructor(message: string) { super(message, "UNAUTHENTICATED") }
}

/** 服务内部错误（HTTP 500） */
export class InternalError extends AppError {
  constructor(message: string) { super(message, "INTERNAL") }
}

// ── HTTP 状态码映射 ────────────────────────────────────────────────────────────

const CODE_TO_STATUS: Record<string, number> = {
  NOT_FOUND:         404,
  VALIDATION:        400,
  PERMISSION_DENIED: 403,
  CONFLICT:          409,
  UPSTREAM_ERROR:    502,
  UNAUTHENTICATED:   401,
  DB_ERROR:          500,
  INTERNAL:          500,
}

/** AppError → HTTP status code */
export function errorToStatus(e: AppError): number {
  return CODE_TO_STATUS[e.code] ?? 500
}

/** 将任意 unknown catch 值转换为 AppError */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  if (e instanceof Error)    return new InternalError(e.message)
  return new InternalError(String(e))
}
