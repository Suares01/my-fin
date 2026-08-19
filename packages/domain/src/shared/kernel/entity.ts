export abstract class Entity<Id> {
  private readonly entityId: Id

  protected constructor(id: Id) {
    this.entityId = id
  }

  get id(): Id {
    return this.entityId
  }

  equals(other: Entity<Id> | null | undefined): boolean {
    return other !== null && other !== undefined && this.id === other.id
  }
}
