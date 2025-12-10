import { describe, expect, it } from "vitest"

const pattern = /(import\s+.*\s+from\s+['"]node:path['"]|import\s+.*\s+from\s+['"]path['"])/

describe("use-path-service smell", () => {
  it("detects import from 'node:path'", () => {
    expect(pattern.test('import * as path from "node:path"')).toBe(true)
  })

  it("detects import from 'path'", () => {
    expect(pattern.test('import * as path from "path"')).toBe(true)
  })

  it("detects named imports from 'node:path'", () => {
    expect(pattern.test('import { join, resolve } from "node:path"')).toBe(true)
  })

  it("detects named imports from 'path'", () => {
    expect(pattern.test('import { join } from "path"')).toBe(true)
  })

  it("detects single-quoted imports", () => {
    expect(pattern.test("import path from 'node:path'")).toBe(true)
  })

  it("does not match @effect/platform Path", () => {
    expect(pattern.test('import { Path } from "@effect/platform"')).toBe(false)
  })

  it("does not match variable named path", () => {
    expect(pattern.test("const path = yield* Path.Path")).toBe(false)
  })

  it("does not match path.join usage", () => {
    expect(pattern.test("const filePath = path.join(dir, file)")).toBe(false)
  })
})
