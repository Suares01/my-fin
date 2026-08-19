import type { DomainErrorCode } from "@workspace/domain"

export type ApplicationErrorCode =
  | DomainErrorCode
  | "DUPLICATE_ENTITY"
  | "ENTITY_NOT_FOUND"
  | "OPTIMISTIC_CONCURRENCY_FAILURE"
  | "UNEXPECTED_ERROR"

export class ApplicationError extends Error {
  readonly name = "ApplicationError"

  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
  }
}
