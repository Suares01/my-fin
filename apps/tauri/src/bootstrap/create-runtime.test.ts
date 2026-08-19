import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "./create-services.js"
import {
  BootstrapError,
  createMyFinRuntime,
  type CreateRuntimeOptions,
} from "./create-runtime.js"

function runtimeFixture(
  overrides: Partial<{
    readonly open: () => Promise<void>
    readonly configure: () => Promise<void>
    readonly verify: () => Promise<void>
    readonly migrate: () => Promise<void>
    readonly compose: () => MyFinServices
  }> = {}
) {
  const calls: string[] = []
  const database = {
    open: vi.fn(async () => {
      calls.push("open")
      await overrides.open?.()
    }),
    execute: vi.fn(),
    query: vi.fn(),
    executeBatch: vi.fn(),
    transaction: vi.fn(),
    readTransaction: vi.fn(),
    health: vi.fn(async () => {
      calls.push("health")
    }),
    close: vi.fn(async () => {
      calls.push("close")
    }),
  }
  const services = {} as MyFinServices
  const options: CreateRuntimeOptions = {
    database,
    configure: async () => {
      calls.push("configure")
      await overrides.configure?.()
    },
    verify: async () => {
      calls.push("verify")
      await overrides.verify?.()
    },
    migrate: async () => {
      calls.push("migrate")
      await overrides.migrate?.()
    },
    compose: () => {
      calls.push("compose")
      return overrides.compose?.() ?? services
    },
  } as CreateRuntimeOptions
  return { calls, database, options, services }
}

describe("createMyFinRuntime", () => {
  it("executes open, configure, verify, migrate and compose in order", async () => {
    const fixture = runtimeFixture()

    const runtime = await createMyFinRuntime(fixture.options)

    expect(fixture.calls).toEqual([
      "open",
      "configure",
      "verify",
      "migrate",
      "compose",
    ])
    expect(runtime.services).toBe(fixture.services)
  })

  it("maps vault opening failure to a safe bootstrap error and closes the partial resource", async () => {
    const fixture = runtimeFixture({
      open: async () => {
        throw new Error("/absolute/vault.sqlite")
      },
    })

    await expect(createMyFinRuntime(fixture.options)).rejects.toMatchObject({
      code: "VAULT_OPEN_FAILED",
      diagnosticId: "bootstrap-open",
    })
    expect(fixture.database.close).toHaveBeenCalledOnce()
    expect(fixture.calls).toEqual(["open", "close"])
  })

  it("maps configuration failure before verification or migration", async () => {
    const fixture = runtimeFixture({
      configure: async () => {
        throw new Error("PRAGMA failure")
      },
    })

    await expect(createMyFinRuntime(fixture.options)).rejects.toMatchObject({
      code: "SQLITE_CONFIGURATION_FAILED",
    })
    expect(fixture.calls).toEqual(["open", "configure", "close"])
  })

  it("preserves the stable mismatch code for verification failure", async () => {
    const fixture = runtimeFixture({
      verify: async () => {
        throw Object.assign(new Error("internal"), {
          code: "SQLITE_PRAGMA_MISMATCH",
        })
      },
    })

    await expect(createMyFinRuntime(fixture.options)).rejects.toMatchObject({
      code: "SQLITE_CONFIGURATION_MISMATCH",
    })
    expect(fixture.calls).toEqual(["open", "configure", "verify", "close"])
  })

  it("maps migration failure and never composes financial services", async () => {
    const compose = vi.fn(() => ({}) as MyFinServices)
    const fixture = runtimeFixture({
      migrate: async () => {
        throw new Error("migration SQL")
      },
      compose,
    })

    await expect(createMyFinRuntime(fixture.options)).rejects.toMatchObject({
      code: "MIGRATION_FAILED",
    })
    expect(compose).not.toHaveBeenCalled()
    expect(fixture.calls).toEqual([
      "open",
      "configure",
      "verify",
      "migrate",
      "close",
    ])
  })

  it("maps composition failure after the database is initialized", async () => {
    const fixture = runtimeFixture({
      compose: () => {
        throw new Error("composition")
      },
    })

    await expect(createMyFinRuntime(fixture.options)).rejects.toMatchObject({
      code: "RUNTIME_COMPOSITION_FAILED",
    })
    expect(fixture.calls).toEqual([
      "open",
      "configure",
      "verify",
      "migrate",
      "compose",
      "close",
    ])
  })

  it("does not expose internal failure messages or paths", async () => {
    const fixture = runtimeFixture({
      open: async () => {
        throw new Error("SQL /private/vault.sqlite")
      },
    })

    const error = await createMyFinRuntime(fixture.options).catch(
      (value: unknown) => value
    )

    expect(error).toBeInstanceOf(BootstrapError)
    expect(error).not.toHaveProperty(
      "message",
      expect.stringContaining("private")
    )
    expect((error as BootstrapError).diagnosticId).toBe("bootstrap-open")
  })

  it("delegates health to the open database", async () => {
    const fixture = runtimeFixture()
    const runtime = await createMyFinRuntime(fixture.options)

    await runtime.health()

    expect(fixture.database.health).toHaveBeenCalledOnce()
    expect(fixture.calls).toContain("health")
  })

  it("disposes the database exactly once", async () => {
    const fixture = runtimeFixture()
    const runtime = await createMyFinRuntime(fixture.options)

    await Promise.all([runtime.dispose(), runtime.dispose(), runtime.dispose()])

    expect(fixture.database.close).toHaveBeenCalledOnce()
    expect(fixture.calls.at(-1)).toBe("close")
  })

  it("keeps the vault intact by never deleting or recreating it on failure", async () => {
    const fixture = runtimeFixture({
      migrate: async () => {
        throw new Error("migration")
      },
    })

    await expect(createMyFinRuntime(fixture.options)).rejects.toBeInstanceOf(
      BootstrapError
    )

    expect(fixture.database).not.toHaveProperty("delete")
    expect(fixture.database).not.toHaveProperty("recreate")
  })

  it("uses the default Tauri database factory when no database is injected", async () => {
    const database = {
      open: vi.fn(),
      execute: vi.fn(),
      query: vi.fn(),
      executeBatch: vi.fn(),
      transaction: vi.fn(),
      readTransaction: vi.fn(),
      health: vi.fn(),
      close: vi.fn(),
    }
    const factory = vi.fn(() => database)
    const fixture = runtimeFixture()

    await createMyFinRuntime({
      ...fixture.options,
      database: undefined,
      createDatabase: factory,
    })

    expect(factory).toHaveBeenCalledOnce()
    expect(database.open).toHaveBeenCalledOnce()
  })

  it("keeps a successful runtime usable until explicit dispose", async () => {
    const fixture = runtimeFixture()
    const runtime = await createMyFinRuntime(fixture.options)

    await runtime.health()
    expect(fixture.database.close).not.toHaveBeenCalled()
    await runtime.dispose()
    expect(fixture.database.close).toHaveBeenCalledOnce()
  })
})
