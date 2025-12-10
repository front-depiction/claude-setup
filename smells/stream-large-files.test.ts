import { describe, expect, it } from "vitest"

const pattern = /fs\.(readFile|readFileString)\s*\(/

describe("stream-large-files smell", () => {
  it("detects fs.readFile()", () => {
    expect(pattern.test('yield* fs.readFile("/path/file.txt")')).toBe(true)
  })

  it("detects fs.readFileString()", () => {
    expect(pattern.test('yield* fs.readFileString("/path/file.txt")')).toBe(true)
  })

  it("detects readFile with options", () => {
    expect(pattern.test('yield* fs.readFile("/path/file.txt", { offset: 0 })')).toBe(true)
  })

  it("detects readFileString with encoding", () => {
    expect(pattern.test('yield* fs.readFileString("/path/file.txt")')).toBe(true)
  })

  it("detects with whitespace before paren", () => {
    expect(pattern.test("yield* fs.readFile (path)")).toBe(true)
  })

  it("does not match fs.stream()", () => {
    expect(pattern.test('fs.stream("/path/file.txt")')).toBe(false)
  })

  it("does not match fs.writeFile()", () => {
    expect(pattern.test('yield* fs.writeFile("/path/file.txt", data)')).toBe(false)
  })

  it("does not match comment about readFile", () => {
    expect(pattern.test("// consider streaming instead of readFile")).toBe(false)
  })

  it("does not match variable assignment", () => {
    expect(pattern.test("const readFile = fs.readFileString")).toBe(false)
  })
})
