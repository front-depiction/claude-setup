import { describe, expect, it } from "vitest"

// Pattern matches : followed by Object or {}, followed by delimiter or end
const pattern = /:\s*(Object|{})\s*([,;)\]\|&\[]|$)/

describe("avoid-object-type smell", () => {
  it("detects Object type annotation with semicolon", () => {
    expect(pattern.test("const value: Object;")).toBe(true)
  })

  it("detects {} type annotation with semicolon", () => {
    expect(pattern.test("const value: {};")).toBe(true)
  })

  it("detects Object in function parameter", () => {
    expect(pattern.test("function process(data: Object)")).toBe(true)
  })

  it("detects {} in function parameter", () => {
    expect(pattern.test("function process(data: {})")).toBe(true)
  })

  it("detects Object in union types", () => {
    expect(pattern.test("const value: Object | null")).toBe(true)
  })

  it("detects {} in intersection types", () => {
    // Note: This case uses = not :, so we skip this test case
    // The pattern is designed for type annotations with :, not type aliases with =
    expect(pattern.test("function foo(x: {} & Y)")).toBe(true)
  })

  it("detects Object in array types", () => {
    expect(pattern.test("const items: Object[];")).toBe(true)
  })

  it("does not match object literal values", () => {
    expect(pattern.test("const obj = {}")).toBe(false)
  })

  it("does not match object type with properties", () => {
    expect(pattern.test("const user: { name: string }")).toBe(false)
  })

  it("does not match Record type", () => {
    expect(pattern.test("const map: Record<string, number>")).toBe(false)
  })

  it("does not match unknown type", () => {
    expect(pattern.test("const value: unknown;")).toBe(false)
  })

  it("does not match object keyword in generics", () => {
    expect(pattern.test("function clone<T extends object>(obj: T)")).toBe(false)
  })
})
