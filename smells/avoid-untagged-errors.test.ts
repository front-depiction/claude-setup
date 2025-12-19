import { describe, expect, it } from "vitest"

const pattern = /(instanceof\s+Error|new\s+Error\s*\()/

describe("avoid-untagged-errors smell", () => {
  it("detects instanceof Error", () => {
    expect(pattern.test("if (e instanceof Error)")).toBe(true)
  })

  it("detects instanceof Error with extra spacing", () => {
    expect(pattern.test("if (e instanceof  Error)")).toBe(true)
  })

  it("detects instanceof Error in catch block", () => {
    expect(pattern.test("} catch (e) { if (e instanceof Error) { } }")).toBe(true)
  })

  it("detects new Error()", () => {
    expect(pattern.test('throw new Error("message")')).toBe(true)
  })

  it("detects new Error() with space", () => {
    expect(pattern.test("throw new Error ()")).toBe(true)
  })

  it("detects new Error in assignment", () => {
    expect(pattern.test('const err = new Error("oops")')).toBe(true)
  })

  it("detects new Error in return", () => {
    expect(pattern.test('return new Error("failed")')).toBe(true)
  })

  it("does not match TaggedError", () => {
    expect(pattern.test("class MyError extends Data.TaggedError")).toBe(false)
  })

  it("does not match catchTag", () => {
    expect(pattern.test('Effect.catchTag("MyError", handler)')).toBe(false)
  })

  it("does not match instanceof MyCustomError", () => {
    expect(pattern.test("if (e instanceof MyCustomError)")).toBe(false)
  })

  it("does not match Error in comment", () => {
    expect(pattern.test("// Error handling code")).toBe(false)
  })

  it("does not match Error type annotation", () => {
    expect(pattern.test("type E = Error")).toBe(false)
  })
})
