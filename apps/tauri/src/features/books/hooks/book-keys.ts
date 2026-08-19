export const bookKeys = {
  all: ["books"] as const,
  detail: (bookId: string) => ["books", bookId, "detail"] as const,
}
