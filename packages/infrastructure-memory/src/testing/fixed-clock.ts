import type { Clock } from "@workspace/application"

export class FixedClock implements Clock {
  constructor(
    private readonly instant: string,
    private readonly date: string
  ) {}

  now(): string {
    return this.instant
  }

  localDate(timezone: string): string {
    void timezone
    return this.date
  }
}
