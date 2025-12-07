import { describe, expect, it } from "vitest"

const pattern = /JSON\.(parse|stringify)\(/

describe("avoid-direct-json smell", () => {
  it("detects JSON.parse call", () => {
    expect(pattern.test('const data = JSON.parse(str)')).toBe(true)
  })

  it("detects JSON.stringify call", () => {
    expect(pattern.test('const str = JSON.stringify(obj)')).toBe(true)
  })

  it("detects JSON.parse with complex argument", () => {
    expect(pattern.test('JSON.parse(await response.text())')).toBe(true)
  })

  it("detects JSON.stringify with options", () => {
    expect(pattern.test('JSON.stringify(data, null, 2)')).toBe(true)
  })

  it("detects JSON.parse in assignment", () => {
    expect(pattern.test('this.config = JSON.parse(content)')).toBe(true)
  })

  it("detects JSON.stringify in return statement", () => {
    expect(pattern.test('return JSON.stringify(result)')).toBe(true)
  })

  it("does not match JSON property access without call", () => {
    expect(pattern.test('const parser = JSON.parse')).toBe(false)
  })

  it("matches JSON.parse even with prefix (regex limitation)", () => {
    expect(pattern.test('myJSON.parse(data)')).toBe(true) // Regex doesn't enforce word boundary
  })

  it("does not match string without parenthesis", () => {
    expect(pattern.test('const name = "JSON.parse"')).toBe(false) // Missing (
  })

  it("does not match comments about JSON", () => {
    expect(pattern.test('// Use JSON for serialization')).toBe(false)
  })

  it("does not match Schema.parseJson", () => {
    expect(pattern.test('Schema.parseJson(User)')).toBe(false)
  })
})
