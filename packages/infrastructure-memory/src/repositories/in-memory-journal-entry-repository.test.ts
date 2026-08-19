import { JournalEntry } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import {
  InMemoryJournalEntryRepository,
  journalEntrySnapshot,
} from "./in-memory-journal-entry-repository.js"
import { InMemoryStore } from "../store/in-memory-store.js"

function entry(overrides: Parameters<typeof journalEntrySnapshot>[0] = {}) {
  return JournalEntry.restore(journalEntrySnapshot(overrides))
}

describe("InMemoryJournalEntryRepository", () => {
  it("reserves independent monotonic sequences per book", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())

    expect(await repository.reserveNextSequence("book-1" as never)).toBe("1")
    expect(await repository.reserveNextSequence("book-1" as never)).toBe("2")
    expect(await repository.reserveNextSequence("book-2" as never)).toBe("1")
    expect(await repository.reserveNextSequence("book-1" as never)).toBe("3")
  })

  it("adds and rehydrates postings as independent values", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())
    const original = entry()
    await repository.add(original)

    const loaded = await repository.findById(original.id)

    expect(loaded).not.toBe(original)
    expect(loaded?.toSnapshot()).toEqual(original.toSnapshot())
    expect(loaded?.postings).not.toBe(original.postings)
  })

  it("returns null for a missing entry", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())

    expect(await repository.findById("missing" as never)).toBeNull()
  })

  it("rejects duplicate IDs", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())
    await repository.add(entry())

    await expect(repository.add(entry())).rejects.toMatchObject({
      code: "DUPLICATE_ENTITY",
    })
  })

  it("rejects a posting ID already used by another entry", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())
    await repository.add(entry())
    const snapshot = journalEntrySnapshot()

    await expect(
      repository.add(
        entry({
          id: "entry-2" as never,
          postings: [
            { ...snapshot.postings[0]!, id: "posting-1" as never },
            { ...snapshot.postings[1]!, id: "posting-3" as never },
          ],
        })
      )
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
  })

  it("preserves reversal links when rehydrating", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())
    const original = entry({
      reversalOf: "entry-original" as never,
      reversedBy: "entry-reversal" as never,
    })
    await repository.add(original)

    expect((await repository.findById(original.id))?.toSnapshot()).toEqual(
      journalEntrySnapshot({
        reversalOf: "entry-original" as never,
        reversedBy: "entry-reversal" as never,
      })
    )
  })

  it("preserves both replacement directions and exact versions when rehydrating", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())
    const original = entry({
      reversedBy: "entry-reversal" as never,
      replacedBy: "entry-replacement" as never,
      version: 1,
    })
    const replacement = entry({
      id: "entry-replacement" as never,
      sequence: "3",
      replacementOf: "entry-1" as never,
      postings: [
        { ...journalEntrySnapshot().postings[0]!, id: "posting-3" as never },
        { ...journalEntrySnapshot().postings[1]!, id: "posting-4" as never },
      ],
    })

    await repository.add(entry())
    await repository.save(original, 0)
    await repository.add(replacement)

    expect((await repository.findById(original.id))?.toSnapshot()).toEqual(
      journalEntrySnapshot({
        reversedBy: "entry-reversal" as never,
        replacedBy: "entry-replacement" as never,
        version: 1,
      })
    )
    expect((await repository.findById(replacement.id))?.toSnapshot()).toEqual(
      journalEntrySnapshot({
        id: "entry-replacement" as never,
        sequence: "3",
        replacementOf: "entry-1" as never,
        postings: [
          { ...journalEntrySnapshot().postings[0]!, id: "posting-3" as never },
          { ...journalEntrySnapshot().postings[1]!, id: "posting-4" as never },
        ],
      })
    )
  })

  it("does not persist a mutation to a loaded entry without save", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())
    await repository.add(entry())
    const loaded = await repository.findById("entry-1" as never)
    loaded?.markReversedBy("entry-reversal" as never)

    expect(
      (await repository.findById("entry-1" as never))?.reversedBy
    ).toBeUndefined()
  })

  it("saves a reversal link at the exact next version", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())
    await repository.add(entry())
    const updated = entry({ reversedBy: "entry-reversal" as never, version: 1 })

    await repository.save(updated, 0)

    expect((await repository.findById(updated.id))?.toSnapshot()).toEqual(
      journalEntrySnapshot({
        reversedBy: "entry-reversal" as never,
        version: 1,
      })
    )
  })

  it("rejects conflict and missing writes without changing stored state", async () => {
    const repository = new InMemoryJournalEntryRepository(new InMemoryStore())
    await repository.add(entry())
    await expect(
      repository.save(entry({ description: "Invalid", version: 2 }), 0)
    ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
    await expect(
      repository.save(entry({ id: "missing" as never, version: 1 }), 0)
    ).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND" })

    expect(
      (await repository.findById("entry-1" as never))?.toSnapshot()
    ).toEqual(journalEntrySnapshot())
  })
})
