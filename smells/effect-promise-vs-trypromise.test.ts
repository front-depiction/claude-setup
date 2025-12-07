import { describe, expect, it } from "vitest"

const pattern = /yield\*\s+Effect\.promise/

describe("effect-promise-vs-trypromise smell", () => {
  it("detects yield* Effect.promise", () => {
    expect(pattern.test("const data = yield* Effect.promise(() => fetch('/api'))")).toBe(true)
  })

  it("detects yield* Effect.promise with multiline", () => {
    const code = `const data = yield* Effect.promise(
      () => fetch('/api')
    )`
    expect(pattern.test(code)).toBe(true)
  })

  it("detects yield* Effect.promise with extra whitespace", () => {
    expect(pattern.test("const data = yield*  Effect.promise(() => fetch('/api'))")).toBe(true)
  })

  it("does not match yield* Effect.tryPromise", () => {
    expect(pattern.test("const data = yield* Effect.tryPromise(() => fetch('/api'))")).toBe(false)
  })

  it("does not match Effect.promise without yield*", () => {
    expect(pattern.test("Effect.promise(() => fetch('/api'))")).toBe(false)
  })

  it("does not match yield* Effect.gen", () => {
    expect(pattern.test("yield* Effect.gen(function* () { })")).toBe(false)
  })

  it("does not match yield* Effect.succeed", () => {
    expect(pattern.test("yield* Effect.succeed(value)")).toBe(false)
  })
})
