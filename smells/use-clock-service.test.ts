import { describe, expect, it } from "vitest"

const pattern = /(new Date\(|Date\.\w+\()/

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

  it("detects new Date()", () => {
    expect(pattern.test("const d = new Date()")).toBe(true)
  })

  it("detects new Date() with arguments", () => {
    expect(pattern.test("const d = new Date(ts)")).toBe(true)
  })

  it("detects new Date() in function", () => {
    expect(pattern.test("const formatTime = (ts: number) => { const d = new Date(ts) }")).toBe(true)
  })

  it("detects Date.parse()", () => {
    expect(pattern.test("const d = Date.parse(str)")).toBe(true)
  })

  it("detects Date.UTC()", () => {
    expect(pattern.test("const d = Date.UTC(2024, 0, 1)")).toBe(true)
  })

  it("does not match Clock.currentTimeMillis", () => {
    expect(pattern.test("yield* Clock.currentTimeMillis")).toBe(false)
  })

  it("does not match DateTime.now", () => {
    expect(pattern.test("yield* DateTime.now")).toBe(false)
  })

  it("does not match DateTime.unsafeNow", () => {
    expect(pattern.test("DateTime.unsafeNow()")).toBe(false)
  })

  it("does not match string containing Date", () => {
    expect(pattern.test("const msg = 'Created Date: today'")).toBe(false)
  })
})
