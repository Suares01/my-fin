export function normalizeSearchText(value: string): string {
  return value.trim().normalize("NFC").toLowerCase()
}
