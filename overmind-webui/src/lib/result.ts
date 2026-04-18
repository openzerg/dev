import type { Result } from "neverthrow"
import type { AppError } from "@openzerg/common"

export function unwrap<T>(result: Result<T, AppError>): T {
  if (result.isOk()) return result.value
  throw result.error
}
