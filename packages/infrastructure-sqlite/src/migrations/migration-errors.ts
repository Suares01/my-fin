export class InvalidMigrationPlanError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = "InvalidMigrationPlanError"
  }
}

export class UnknownAppliedMigrationError extends Error {
  public readonly version: number

  public constructor(version: number) {
    super(
      "Migration version " + version + " is not present in the current plan"
    )
    this.name = "UnknownAppliedMigrationError"
    this.version = version
  }
}

export class ModifiedMigrationError extends Error {
  public readonly version: number

  public constructor(version: number) {
    super("Migration version " + version + " has a different checksum")
    this.name = "ModifiedMigrationError"
    this.version = version
  }
}
