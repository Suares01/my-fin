import { describe, expect, it, vi } from "vitest"
import { TauriClock } from "./clock.js"
import { TauriEventPublisher } from "./event-publisher.js"
import { TauriIdGenerator } from "./id-generator.js"
import { TauriLifecycle } from "./lifecycle.js"

const event = (eventId: string) => ({
  eventId,
  type: "FinancialBookCreated" as const,
  eventVersion: 1 as const,
  occurredAt: "2026-08-05T00:00:00.000Z",
  aggregateId: "book-1",
  aggregateVersion: 0,
  bookId: "book-1",
  payload: { bookId: "book-1" },
})

describe("TauriIdGenerator", () => {
  it("uses UUID v4 for all five branded operations", () => {
    const values = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ]
    const generator = new TauriIdGenerator({
      randomUUID: () => values.shift() as string,
    })

    const generated = [
      generator.nextBookId(),
      generator.nextLedgerAccountId(),
      generator.nextJournalEntryId(),
      generator.nextPostingId(),
      generator.nextEventId(),
    ]

    expect(generated).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ])
    expect(new Set(generated)).toHaveLength(5)
  })

  it("creates a UUID with the v4 marker by default", () => {
    const value = new TauriIdGenerator().nextEventId()

    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it("does not reuse generated values when the source provides unique UUIDs", () => {
    const generator = new TauriIdGenerator({
      randomUUID: vi.fn().mockReturnValueOnce("a").mockReturnValueOnce("b"),
    })

    expect(generator.nextBookId()).not.toBe(generator.nextBookId())
  })
})

describe("TauriClock", () => {
  it("returns UTC ISO and converts a date across timezone boundaries", () => {
    const clock = new TauriClock({
      now: () => new Date("2026-08-05T01:30:00.000Z"),
    })

    expect(clock.now()).toBe("2026-08-05T01:30:00.000Z")
    expect(clock.localDate("America/Sao_Paulo")).toBe("2026-08-04")
    expect(clock.localDate("Asia/Tokyo")).toBe("2026-08-05")
  })

  it("rejects an invalid timezone through Intl validation", () => {
    const clock = new TauriClock({
      now: () => new Date("2026-08-05T00:00:00.000Z"),
    })

    expect(() => clock.localDate("Invalid/Timezone")).toThrow(RangeError)
  })

  it("formats a local date with zero-padded month and day", () => {
    const clock = new TauriClock({
      now: () => new Date("2026-01-02T12:00:00.000Z"),
    })

    expect(clock.localDate("UTC")).toBe("2026-01-02")
  })

  it("reads a fresh instant for each clock call", () => {
    const dates = [
      new Date("2026-08-05T00:00:00.000Z"),
      new Date("2026-08-06T00:00:00.000Z"),
    ]
    const clock = new TauriClock({ now: () => dates.shift() as Date })

    expect(clock.now()).toBe("2026-08-05T00:00:00.000Z")
    expect(clock.now()).toBe("2026-08-06T00:00:00.000Z")
  })
})

describe("TauriEventPublisher", () => {
  it("delivers concurrent publishes in envelope order", async () => {
    const received: string[] = []
    const publisher = new TauriEventPublisher()
    publisher.subscribe(async (item) => {
      await Promise.resolve()
      received.push(item.eventId)
    })

    await Promise.all([
      publisher.publish(event("first")),
      publisher.publish(event("second")),
    ])

    expect(received).toEqual(["first", "second"])
  })

  it("contains listener failure without rejecting the committed event publication", async () => {
    const publisher = new TauriEventPublisher()
    const received: string[] = []
    publisher.subscribe(() => {
      throw new Error("listener failed")
    })
    publisher.subscribe((item) => {
      received.push(item.eventId)
    })

    await expect(publisher.publish(event("committed"))).resolves.toBeUndefined()
    expect(received).toEqual(["committed"])
    expect(publisher.diagnostics).toHaveLength(1)
  })

  it("stops calling an unsubscribed listener", async () => {
    const listener = vi.fn()
    const publisher = new TauriEventPublisher()
    const unsubscribe = publisher.subscribe(listener)

    unsubscribe()
    await publisher.publish(event("not-delivered"))

    expect(listener).not.toHaveBeenCalled()
  })

  it("continues with later listeners after an earlier listener fails", async () => {
    const order: string[] = []
    const publisher = new TauriEventPublisher()
    publisher.subscribe(() => {
      order.push("failed")
      throw new Error("failure")
    })
    publisher.subscribe(() => {
      order.push("continued")
    })

    await publisher.publish(event("event"))

    expect(order).toEqual(["failed", "continued"])
  })

  it("records each listener failure as a diagnostic", async () => {
    const publisher = new TauriEventPublisher()
    publisher.subscribe(() => {
      throw new Error("first")
    })
    publisher.subscribe(() => {
      throw new Error("second")
    })

    await publisher.publish(event("event"))

    expect(publisher.diagnostics).toHaveLength(2)
  })
})

describe("TauriLifecycle", () => {
  it("bridges resume and close events and removes both listeners", async () => {
    let focusHandler:
      | ((event: { readonly payload: boolean }) => void | Promise<void>)
      | undefined
    let closeHandler: (() => void | Promise<void>) | undefined
    const focusUnlisten: () => void = vi.fn()
    const closeUnlisten: () => void = vi.fn()
    const onResume = vi.fn()
    const onCloseRequested = vi.fn()
    const lifecycle = new TauriLifecycle({
      window: {
        onFocusChanged: async (handler) => {
          focusHandler = handler
          return focusUnlisten
        },
        onCloseRequested: async (handler) => {
          closeHandler = handler
          return closeUnlisten
        },
      },
    })

    const unsubscribe = await lifecycle.subscribe({
      onResume,
      onCloseRequested,
    })
    await focusHandler?.({ payload: true })
    await focusHandler?.({ payload: false })
    await closeHandler?.()
    unsubscribe()
    unsubscribe()

    expect(onResume).toHaveBeenCalledOnce()
    expect(onCloseRequested).toHaveBeenCalledOnce()
    expect(focusUnlisten).toHaveBeenCalledOnce()
    expect(closeUnlisten).toHaveBeenCalledOnce()
  })

  it("cleans the first listener if registration of the second fails", async () => {
    const focusUnlisten: () => void = vi.fn()
    const registrationError = new Error("registration failed")
    const lifecycle = new TauriLifecycle({
      window: {
        onFocusChanged: async () => focusUnlisten,
        onCloseRequested: async () => {
          throw registrationError
        },
      },
    })

    await expect(
      lifecycle.subscribe({ onResume: vi.fn(), onCloseRequested: vi.fn() })
    ).rejects.toBe(registrationError)
    expect(focusUnlisten).toHaveBeenCalledOnce()
  })

  it("ignores focus loss without calling resume", async () => {
    let focusHandler:
      | ((event: { readonly payload: boolean }) => void | Promise<void>)
      | undefined
    const lifecycle = new TauriLifecycle({
      window: {
        onFocusChanged: async (handler) => {
          focusHandler = handler
          const unlisten: () => void = vi.fn()
          return unlisten
        },
        onCloseRequested: async () => {
          const unlisten: () => void = vi.fn()
          return unlisten
        },
      },
    })
    const onResume = vi.fn()

    await lifecycle.subscribe({ onResume, onCloseRequested: vi.fn() })
    await focusHandler?.({ payload: false })

    expect(onResume).not.toHaveBeenCalled()
  })

  it("does not remove listeners more than once", async () => {
    const unlisten = vi.fn()
    const lifecycle = new TauriLifecycle({
      window: {
        onFocusChanged: async () => unlisten,
        onCloseRequested: async () => unlisten,
      },
    })

    const unsubscribe = await lifecycle.subscribe({
      onResume: vi.fn(),
      onCloseRequested: vi.fn(),
    })
    unsubscribe()
    unsubscribe()

    expect(unlisten).toHaveBeenCalledTimes(2)
  })
})

describe("platform source boundary", () => {
  it("keeps Tauri API imports inside infrastructure-tauri", async () => {
    const { readFile } = await import("node:fs/promises")
    const { resolve } = await import("node:path")
    const workspaceRoot = resolve(process.cwd(), "../..")
    const sourceRoots = [
      resolve(workspaceRoot, "packages"),
      resolve(workspaceRoot, "apps"),
    ]
    const forbiddenOutsideAdapter: string[] = []

    for (const root of sourceRoots) {
      const entries = await walk(root)
      for (const file of entries.filter(
        (candidate) => candidate.endsWith(".ts") || candidate.endsWith(".tsx")
      )) {
        const source = await readFile(file, "utf8")
        if (
          source.includes("@tauri-apps/api") &&
          !file.includes("packages/infrastructure-tauri/src/")
        ) {
          forbiddenOutsideAdapter.push(file)
        }
      }
    }

    expect(forbiddenOutsideAdapter).toEqual([])
  })
})

async function walk(directory: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises")
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".turbo"
    ) {
      continue
    }
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...(await walk(path)))
    } else {
      files.push(path)
    }
  }
  return files
}
