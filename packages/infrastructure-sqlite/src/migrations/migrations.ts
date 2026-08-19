export type SqliteMigration = {
  readonly version: number
  readonly name: string
  readonly checksum: string
  readonly sql: string
}
