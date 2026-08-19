import type {
  DomainEventEnvelope,
  DomainEventPublisher,
} from "@workspace/application"

export type DomainEventListener = (
  event: DomainEventEnvelope
) => void | Promise<void>

export class TauriEventPublisher implements DomainEventPublisher {
  private readonly listeners = new Set<DomainEventListener>()
  private readonly listenerErrors: unknown[] = []
  private publishQueue: Promise<void> = Promise.resolve()

  public subscribe(listener: DomainEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public publish(event: DomainEventEnvelope): Promise<void> {
    const operation = this.publishQueue.then(async () => {
      for (const listener of this.listeners) {
        try {
          await listener(event)
        } catch (error: unknown) {
          this.listenerErrors.push(error)
        }
      }
    })
    this.publishQueue = operation.then(
      () => undefined,
      () => undefined
    )
    return operation
  }

  public get diagnostics(): readonly unknown[] {
    return [...this.listenerErrors]
  }
}
