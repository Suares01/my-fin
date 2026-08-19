export type DomainErrorCode = string

export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly details?: Readonly<Record<string, unknown>>

  constructor(
    code: DomainErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message)
    this.name = "DomainError"
    this.code = code
    this.details = details
  }
}
