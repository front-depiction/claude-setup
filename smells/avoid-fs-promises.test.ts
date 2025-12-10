import { describe, expect, it } from "vitest"

const pattern = /(import\s+.*\s+from\s+['"]node:fs\/promises['"]|import\s+.*\s+from\s+['"]fs\/promises['"])/

describe("avoid-fs-promises smell", () => {
  it("detects import from 'node:fs/promises'", () => {
    expect(pattern.test('import { readFile } from "node:fs/promises"')).toBe(true)
  })

  it("detects import from 'fs/promises'", () => {
    expect(pattern.test('import { readFile } from "fs/promises"')).toBe(true)
  })

  it("detects namespace import from 'node:fs/promises'", () => {
    expect(pattern.test('import * as fs from "node:fs/promises"')).toBe(true)
  })

  it("detects namespace import from 'fs/promises'", () => {
    expect(pattern.test('import * as fs from "fs/promises"')).toBe(true)
  })

  it("detects multiple named imports", () => {
    expect(pattern.test('import { readFile, writeFile, mkdir } from "node:fs/promises"')).toBe(true)
  })

  it("detects single-quoted imports", () => {
    expect(pattern.test("import { readFile } from 'fs/promises'")).toBe(true)
  })

  it("does not match @effect/platform FileSystem", () => {
    expect(pattern.test('import { FileSystem } from "@effect/platform"')).toBe(false)
  })

  it("does not match plain node:fs import", () => {
    expect(pattern.test('import * as fs from "node:fs"')).toBe(false)
  })

  it("does not match variable named promises", () => {
    expect(pattern.test("const promises = []")).toBe(false)
  })
})
