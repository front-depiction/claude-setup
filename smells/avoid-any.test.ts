import { describe, expect, it } from "vitest"

const pattern = /as\s+(any|unknown\s+as)/

describe("avoid-any smell", () => {
  describe("as any", () => {
    it("detects 'as any' type assertion", () => {
      expect(pattern.test("const value = data as any")).toBe(true)
    })

    it("detects 'as any' with extra whitespace", () => {
      expect(pattern.test("const value = data as  any")).toBe(true)
    })

    it("detects 'as any' in property access", () => {
      expect(pattern.test("(obj as any).property")).toBe(true)
    })
  })

  describe("as unknown as", () => {
    it("detects 'as unknown as' double cast", () => {
      expect(pattern.test("const value = data as unknown as string")).toBe(true)
    })

    it("detects 'as unknown as' with extra whitespace", () => {
      expect(pattern.test("const value = data as  unknown  as string")).toBe(true)
    })

    it("detects 'as unknown as' in property access", () => {
      expect(pattern.test("(obj as unknown as MyType).property")).toBe(true)
    })

    it("detects 'as unknown as' in function return", () => {
      expect(pattern.test("return response as unknown as User")).toBe(true)
    })
  })

  describe("safe patterns (should not match)", () => {
    it("does not match 'as unknown' alone (legitimate narrowing)", () => {
      expect(pattern.test("const value = data as unknown")).toBe(false)
    })

    it("does not match 'as string'", () => {
      expect(pattern.test("const value = data as string")).toBe(false)
    })

    it("does not match variable named 'asAny'", () => {
      expect(pattern.test("const asAny = 42")).toBe(false)
    })

    it("does not match 'as const'", () => {
      expect(pattern.test("const value = [1, 2, 3] as const")).toBe(false)
    })
  })
})
