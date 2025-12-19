import { describe, expect, it } from "vitest"

const pattern = /\|\s*null(?!\s*\|)|null\s*\|/

describe("prefer-option-over-null smell", () => {
  describe("type | null (null last)", () => {
    it("detects 'string | null'", () => {
      expect(pattern.test("type Name = string | null")).toBe(true)
    })

    it("detects '| null' in function return type", () => {
      expect(pattern.test("function find(id: string): User | null")).toBe(true)
    })

    it("detects '| null' with extra whitespace", () => {
      expect(pattern.test("type T = string |  null")).toBe(true)
    })

    it("detects '| null' in generic type", () => {
      expect(pattern.test("const x: Array<string | null> = []")).toBe(true)
    })
  })

  describe("null | type (null first)", () => {
    it("detects 'null | string'", () => {
      expect(pattern.test("type Name = null | string")).toBe(true)
    })

    it("detects 'null |' with extra whitespace", () => {
      expect(pattern.test("type T = null  | string")).toBe(true)
    })
  })

  describe("safe patterns (should not match)", () => {
    it("does not match standalone null value", () => {
      expect(pattern.test("const x = null")).toBe(false)
    })

    it("does not match null in equality check", () => {
      expect(pattern.test("if (x === null)")).toBe(false)
    })

    it("does not match 'nullable' word", () => {
      expect(pattern.test("// This field is nullable")).toBe(false)
    })

    it("does not match null in Option.fromNullable", () => {
      expect(pattern.test("Option.fromNullable(maybeNull)")).toBe(false)
    })

    it("does not match comments about null", () => {
      expect(pattern.test("// Returns null if not found")).toBe(false)
    })

    it("does not match string literal containing null", () => {
      expect(pattern.test('const msg = "value is null"')).toBe(false)
    })
  })
})
