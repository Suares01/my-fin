import type { Clock } from "@workspace/application"

export type TauriClockOptions = {
  readonly now?: () => Date
}

export class TauriClock implements Clock {
  private readonly readNow: () => Date

  public constructor(options: TauriClockOptions = {}) {
    this.readNow = options.now ?? (() => new Date())
  }

  public now(): string {
    return this.readNow().toISOString()
  }

  public localDate(timezone: string): string {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(this.readNow())
    const values = new Map(
      parts
        .filter(
          (part) =>
            part.type === "year" || part.type === "month" || part.type === "day"
        )
        .map((part) => [part.type, part.value])
    )

    return `${values.get("year")}-${values.get("month")}-${values.get("day")}`
  }
}
