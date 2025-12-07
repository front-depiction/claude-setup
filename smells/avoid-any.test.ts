import { describe, expect, it } from "vitest"

const pattern = /as\s+any/

describe("avoid-any smell", () => {
  it("detects 'as any' type assertion", () => {
    expect(pattern.test("const value = data as any")).toBe(true)
  })

  it("detects 'as any' with extra whitespace", () => {
    expect(pattern.test("const value = data as  any")).toBe(true)
  })

  it("detects 'as any' in property access", () => {
    expect(pattern.test("(obj as any).property")).toBe(true)
  })

  it("does not match 'as unknown'", () => {
    expect(pattern.test("const value = data as unknown")).toBe(false)
  })

  it("does not match 'as string'", () => {
    expect(pattern.test("const value = data as string")).toBe(false)
  })

  it("does not match variable named 'asAny'", () => {
    expect(pattern.test("const asAny = 42")).toBe(false)
  })
})
