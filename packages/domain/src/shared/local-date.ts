import { DomainError } from "./kernel/domain-error.js"

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export class LocalDate {
  private constructor(private readonly dateValue: string) {}

  static parse(value: string): LocalDate {
    const match = DATE_PATTERN.exec(value)
    if (match === null) {
      throw invalidDate()
    }

    const [, yearText, monthText, dayText] = match
    if (
      yearText === undefined ||
      monthText === undefined ||
      dayText === undefined
    ) {
      throw invalidDate()
    }

    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)

    if (
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(year, month)
    ) {
      throw invalidDate()
    }

    return new LocalDate(value)
  }

  get value(): string {
    return this.dateValue
  }

  compareTo(other: LocalDate): -1 | 0 | 1 {
    if (this.value < other.value) {
      return -1
    }

    if (this.value > other.value) {
      return 1
    }

    return 0
  }

  equals(other: LocalDate): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

function invalidDate(): DomainError {
  return new DomainError("INVALID_DATE", "Date must be a valid YYYY-MM-DD day")
}
