import { describe, expect, it } from "vitest"

const pattern = /(import\s+.*\s+from\s+['"]node:fs['"]|import\s+.*\s+from\s+['"]fs['"]|require\(['"]node:fs['"]\)|require\(['"]fs['"]\))/

describe("use-filesystem-service smell", () => {
  it("detects import from 'node:fs'", () => {
    expect(pattern.test('import * as fs from "node:fs"')).toBe(true)
  })

  it("detects import from 'fs'", () => {
    expect(pattern.test('import * as fs from "fs"')).toBe(true)
  })

  it("detects named imports from 'node:fs'", () => {
    expect(pattern.test('import { readFileSync } from "node:fs"')).toBe(true)
  })

  it("detects named imports from 'fs'", () => {
    expect(pattern.test('import { readFileSync, writeFileSync } from "fs"')).toBe(true)
  })

  it("detects require('node:fs')", () => {
    expect(pattern.test('const fs = require("node:fs")')).toBe(true)
  })

  it("detects require('fs')", () => {
    expect(pattern.test('const fs = require("fs")')).toBe(true)
  })

  it("detects single-quoted imports", () => {
    expect(pattern.test("import * as fs from 'node:fs'")).toBe(true)
  })

  it("does not match @effect/platform FileSystem", () => {
    expect(pattern.test('import { FileSystem } from "@effect/platform"')).toBe(false)
  })

  it("does not match fs/promises imports", () => {
    expect(pattern.test('import { readFile } from "node:fs/promises"')).toBe(false)
  })

  it("does not match variable named fs", () => {
    expect(pattern.test("const fs = yield* FileSystem.FileSystem")).toBe(false)
  })
})
