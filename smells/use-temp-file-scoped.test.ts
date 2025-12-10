import { describe, expect, it } from "vitest"

const pattern = /\.(makeTempFile|makeTempDirectory)\s*\(/

describe("use-temp-file-scoped smell", () => {
  it("detects fs.makeTempFile()", () => {
    expect(pattern.test("yield* fs.makeTempFile()")).toBe(true)
  })

  it("detects fs.makeTempDirectory()", () => {
    expect(pattern.test("yield* fs.makeTempDirectory()")).toBe(true)
  })

  it("detects makeTempFile with options", () => {
    expect(pattern.test('yield* fs.makeTempFile({ prefix: "test" })')).toBe(true)
  })

  it("detects makeTempDirectory with options", () => {
    expect(pattern.test('yield* fs.makeTempDirectory({ prefix: "test" })')).toBe(true)
  })

  it("detects with whitespace before paren", () => {
    expect(pattern.test("yield* fs.makeTempFile ()")).toBe(true)
  })

  it("does not match makeTempFileScoped", () => {
    expect(pattern.test("yield* fs.makeTempFileScoped()")).toBe(false)
  })

  it("does not match makeTempDirectoryScoped", () => {
    expect(pattern.test("yield* fs.makeTempDirectoryScoped()")).toBe(false)
  })

  it("does not match comment about makeTempFile", () => {
    expect(pattern.test("// use makeTempFileScoped instead of makeTempFile")).toBe(false)
  })

  it("does not match string containing makeTempFile", () => {
    expect(pattern.test('"prefer makeTempFileScoped over makeTempFile"')).toBe(false)
  })
})
