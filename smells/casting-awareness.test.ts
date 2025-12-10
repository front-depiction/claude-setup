import { describe, expect, it } from "vitest"

const pattern = /as\s+(?!const\b)\w+/

describe("casting-awareness smell", () => {
  describe("detects type assertions", () => {
    it("detects 'as string'", () => {
      expect(pattern.test("const value = data as string")).toBe(true)
    })

    it("detects 'as number'", () => {
      expect(pattern.test("const value = data as number")).toBe(true)
    })

    it("detects 'as unknown'", () => {
      expect(pattern.test("const value = data as unknown")).toBe(true)
    })

    it("detects 'as any'", () => {
      expect(pattern.test("const value = data as any")).toBe(true)
    })

    it("detects PascalCase type assertions", () => {
      expect(pattern.test("const user = data as User")).toBe(true)
    })

    it("detects generic type assertions", () => {
      expect(pattern.test("const items = data as Array")).toBe(true)
    })

    it("detects assertions with extra whitespace", () => {
      expect(pattern.test("const value = data as  string")).toBe(true)
    })
  })

  describe("allows const assertions", () => {
    it("does not match 'as const'", () => {
      expect(pattern.test("const value = [1, 2, 3] as const")).toBe(false)
    })

    it("does not match 'as const' with extra whitespace", () => {
      expect(pattern.test("const value = { a: 1 } as  const")).toBe(false)
    })
  })

  describe("does not match non-casting patterns", () => {
    it("does not match variable names containing 'as'", () => {
      expect(pattern.test("const asString = 42")).toBe(false)
    })

    it("does not match 'has' pattern", () => {
      expect(pattern.test("obj.has(key)")).toBe(false)
    })
  })
})
