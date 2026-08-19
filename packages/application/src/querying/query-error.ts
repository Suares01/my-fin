import { DomainError } from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"

export function toQueryApplicationError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error
  }

  if (error instanceof DomainError) {
    return new ApplicationError(error.code, error.message, error.details)
  }

  return new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
}
