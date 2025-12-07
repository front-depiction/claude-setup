import { describe, expect, it } from "vitest"

const pattern = /Effect\.run(Sync|Promise)/

describe("effect-run-in-body smell", () => {
  it("detects Effect.runSync", () => {
    expect(pattern.test("const result = Effect.runSync(effect)")).toBe(true)
  })

  it("detects Effect.runPromise", () => {
    expect(pattern.test("const result = await Effect.runPromise(effect)")).toBe(true)
  })

  it("detects Effect.runSync in function body", () => {
    const code = `function processUser(id: string) {
      const user = Effect.runSync(fetchUser(id))
      return user
    }`
    expect(pattern.test(code)).toBe(true)
  })

  it("detects Effect.runPromise in async function", () => {
    const code = `async function processUser(id: string) {
      const user = await Effect.runPromise(fetchUser(id))
      return user
    }`
    expect(pattern.test(code)).toBe(true)
  })

  it("does not match Effect.gen", () => {
    expect(pattern.test("Effect.gen(function* () { })")).toBe(false)
  })

  it("does not match Effect.succeed", () => {
    expect(pattern.test("Effect.succeed(value)")).toBe(false)
  })

  it("does not match Effect.fail", () => {
    expect(pattern.test("Effect.fail(error)")).toBe(false)
  })

  it("does not match Effect.runFork", () => {
    expect(pattern.test("Effect.runFork(effect)")).toBe(false)
  })
})
