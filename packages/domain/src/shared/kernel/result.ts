export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return { ok: true, value }
  },

  fail<E>(error: E): Result<never, E> {
    return { ok: false, error }
  },
}
