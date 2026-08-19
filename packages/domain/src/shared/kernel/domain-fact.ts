export interface DomainFact<TType extends string = string, TPayload = unknown> {
  readonly type: TType
  readonly aggregateId: string
  readonly aggregateVersion: number
  readonly payload: TPayload
}
