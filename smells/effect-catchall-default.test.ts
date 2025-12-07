import { describe, expect, it } from "vitest"

// Pattern matches Effect.catchAll with arrow function returning succeed or sync
// Uses non-greedy match to find => then succeed/sync
const pattern = /Effect\.catchAll\(.*?=>\s*(Effect\.)?(succeed|sync)\(/

describe("effect-catchall-default smell", () => {
  it("detects Effect.catchAll with Effect.succeed", () => {
    expect(pattern.test("Effect.catchAll(() => Effect.succeed([]))")).toBe(true)
  })

  it("detects Effect.catchAll with succeed (no Effect prefix)", () => {
    expect(pattern.test("Effect.catchAll(() => succeed([]))")).toBe(true)
  })

  it("detects Effect.catchAll with Effect.sync", () => {
    expect(pattern.test("Effect.catchAll(() => Effect.sync(() => []))")).toBe(true)
  })

  it("detects Effect.catchAll with sync (no Effect prefix)", () => {
    expect(pattern.test("Effect.catchAll(() => sync(() => []))")).toBe(true)
  })

  it("detects Effect.catchAll with multiline arrow function", () => {
    const code = `Effect.catchAll((error) =>
      Effect.succeed([])
    )`
    expect(pattern.test(code)).toBe(true)
  })

  it("detects Effect.catchAll with complex default value", () => {
    expect(pattern.test("Effect.catchAll(() => Effect.succeed({ data: [] }))")).toBe(true)
  })

  it("does not match Effect.catchTag", () => {
    expect(pattern.test("Effect.catchTag('Error', () => Effect.succeed([]))")).toBe(false)
  })

  it("does not match Effect.catchAll with Effect.fail", () => {
    expect(pattern.test("Effect.catchAll(() => Effect.fail(error))")).toBe(false)
  })

  it("does not match Effect.catchAll with Effect.gen", () => {
    expect(pattern.test("Effect.catchAll(() => Effect.gen(function* () {}))")).toBe(false)
  })

  it("does not match Effect.catchAll with logging before succeed", () => {
    const code = `Effect.catchAll(() => Effect.gen(function* () {
      yield* Effect.log('error')
      return []
    }))`
    expect(pattern.test(code)).toBe(false)
  })
})
