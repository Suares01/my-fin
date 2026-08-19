import { describe, expect, it } from "vitest"
import { AggregateRoot } from "./aggregate-root.js"
import { DomainError } from "./domain-error.js"
import type { DomainFact } from "./domain-fact.js"
import { Entity } from "./entity.js"
import { Result } from "./result.js"

class TestEntity extends Entity<string> {
  constructor(id: string) {
    super(id)
  }
}

interface TestSnapshot {
  readonly id: string
  readonly label: string
}

class TestAggregate extends AggregateRoot<string, TestSnapshot> {
  constructor(
    id: string,
    private readonly label: string
  ) {
    super(id)
  }

  recordTestFact(type: string, payload: unknown): void {
    const fact: DomainFact = {
      type,
      aggregateId: this.id,
      aggregateVersion: 0,
      payload,
    }
    this.recordFact(fact)
  }

  toSnapshot(): TestSnapshot {
    return { id: this.id, label: this.label }
  }
}

describe("Entity", () => {
  it("compares entities by identity", () => {
    const first = new TestEntity("entity-1")
    const sameIdentity = new TestEntity("entity-1")
    const differentIdentity = new TestEntity("entity-2")

    expect(first.equals(sameIdentity)).toBe(true)
    expect(first.equals(differentIdentity)).toBe(false)
    expect(first.equals(null)).toBe(false)
    expect(first.id).toBe("entity-1")
  })

  it("does not expose an id mutator", () => {
    const entity = new TestEntity("entity-1")

    expect(
      Object.getOwnPropertyDescriptor(Entity.prototype, "id")
    ).toMatchObject({ get: expect.any(Function), set: undefined })
    expect(entity.id).toBe("entity-1")
  })
})

describe("AggregateRoot", () => {
  it("keeps facts out of snapshots", () => {
    const aggregate = new TestAggregate("aggregate-1", "initial")
    aggregate.recordTestFact("Renamed", { label: "changed" })

    expect(aggregate.toSnapshot()).toEqual({
      id: "aggregate-1",
      label: "initial",
    })
  })

  it("accumulates pending facts in recording order", () => {
    const aggregate = new TestAggregate("aggregate-1", "initial")
    aggregate.recordTestFact("FirstFact", { sequence: 1 })
    aggregate.recordTestFact("SecondFact", { sequence: 2 })

    expect(aggregate.pullDomainFacts()).toEqual([
      {
        type: "FirstFact",
        aggregateId: "aggregate-1",
        aggregateVersion: 0,
        payload: { sequence: 1 },
      },
      {
        type: "SecondFact",
        aggregateId: "aggregate-1",
        aggregateVersion: 0,
        payload: { sequence: 2 },
      },
    ])
  })

  it("removes facts when they are pulled", () => {
    const aggregate = new TestAggregate("aggregate-1", "initial")
    aggregate.recordTestFact("Fact", { sequence: 1 })

    expect(aggregate.pullDomainFacts()).toHaveLength(1)
    expect(aggregate.pullDomainFacts()).toEqual([])
  })
})

describe("DomainError", () => {
  it("preserves a stable code and message", () => {
    const error = new DomainError("INVALID_INPUT", "Input is invalid", {
      field: "name",
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("DomainError")
    expect(error.code).toBe("INVALID_INPUT")
    expect(error.message).toBe("Input is invalid")
    expect(error.details).toEqual({ field: "name" })
  })
})

describe("Result", () => {
  it("creates a discriminated success result", () => {
    const result = Result.ok({ id: "entity-1" })

    expect(result).toEqual({ ok: true, value: { id: "entity-1" } })
    if (result.ok) {
      expect(result.value.id).toBe("entity-1")
    }
  })

  it("creates a discriminated failure result", () => {
    const error = new DomainError("INVALID_INPUT", "Input is invalid")
    const result = Result.fail(error)

    expect(result).toEqual({ ok: false, error })
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT")
    }
  })
})
