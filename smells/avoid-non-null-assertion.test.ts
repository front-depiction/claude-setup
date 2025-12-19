import { describe, expect, it } from "vitest"

// Pattern requires word char, ) or ] before ! to avoid matching ! inside strings
const pattern = /[\w\)\]]!\s*[;.\[\(]/

describe("avoid-non-null-assertion smell", () => {
  it("detects non-null assertion with semicolon", () => {
    expect(pattern.test("const value = obj!;")).toBe(true)
  })

  it("detects non-null assertion with property access", () => {
    expect(pattern.test("const width = element!.offsetWidth")).toBe(true)
  })

  it("detects non-null assertion with method call", () => {
    expect(pattern.test("users.find(u => u.id === id)!.name")).toBe(true)
  })

  it("detects non-null assertion with array access", () => {
    expect(pattern.test("const first = array![0]")).toBe(true)
  })

  it("detects non-null assertion with function call", () => {
    expect(pattern.test("getValue()!(param)")).toBe(true)
  })

  it("does not match logical NOT operator", () => {
    expect(pattern.test("if (!condition) { }")).toBe(false)
  })

  it("does not match inequality operator", () => {
    expect(pattern.test("if (a !== b)")).toBe(false)
  })

  it("does not match negation in expressions", () => {
    expect(pattern.test("const result = !value && other")).toBe(false)
  })

  it("does not match optional chaining", () => {
    expect(pattern.test("const value = obj?.prop")).toBe(false)
  })

  it("does not match ! inside glob pattern strings", () => {
    expect(pattern.test('const glob = "**/!(*.vm).{ts,tsx}"')).toBe(false)
  })

  it("does not match ! inside regex strings", () => {
    expect(pattern.test("const re = /!(foo)/")).toBe(false)
  })
})
