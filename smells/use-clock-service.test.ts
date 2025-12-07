import { describe, expect, it } from "vitest"

const pattern = /Date\.now\(\)/

describe("use-clock-service smell", () => {
  it("detects Date.now()", () => {
    expect(pattern.test("const t = Date.now()")).toBe(true)
  })

  it("detects Date.now() in expressions", () => {
    expect(pattern.test("const later = Date.now() + 1000")).toBe(true)
  })

  it("detects Date.now() in property assignment", () => {
    expect(pattern.test("timestamp: Date.now()")).toBe(true)
  })

  it("does not match Clock.currentTimeMillis", () => {
    expect(pattern.test("yield* Clock.currentTimeMillis")).toBe(false)
  })

  it("does not match DateTime.now", () => {
    expect(pattern.test("yield* DateTime.now")).toBe(false)
  })

  it("does not match Date.parse()", () => {
    expect(pattern.test("const d = Date.parse(str)")).toBe(false)
  })

  it("does not match new Date()", () => {
    expect(pattern.test("const d = new Date()")).toBe(false)
  })
})
