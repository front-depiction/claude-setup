import { describe, expect, it } from "vitest"

const pattern = /(readFileSync|writeFileSync|mkdirSync|readdirSync|statSync|existsSync|copyFileSync|unlinkSync|rmdirSync|renameSync|appendFileSync)\s*\(/

describe("avoid-sync-fs smell", () => {
  it("detects readFileSync", () => {
    expect(pattern.test('const content = readFileSync("file.txt")')).toBe(true)
  })

  it("detects writeFileSync", () => {
    expect(pattern.test('writeFileSync("file.txt", content)')).toBe(true)
  })

  it("detects mkdirSync", () => {
    expect(pattern.test('mkdirSync("/path/to/dir")')).toBe(true)
  })

  it("detects readdirSync", () => {
    expect(pattern.test('const files = readdirSync(".")')).toBe(true)
  })

  it("detects statSync", () => {
    expect(pattern.test('const stats = statSync(filePath)')).toBe(true)
  })

  it("detects existsSync", () => {
    expect(pattern.test('if (existsSync(path)) {')).toBe(true)
  })

  it("detects copyFileSync", () => {
    expect(pattern.test('copyFileSync(src, dest)')).toBe(true)
  })

  it("detects unlinkSync", () => {
    expect(pattern.test('unlinkSync(filePath)')).toBe(true)
  })

  it("detects rmdirSync", () => {
    expect(pattern.test('rmdirSync(dirPath)')).toBe(true)
  })

  it("detects renameSync", () => {
    expect(pattern.test('renameSync(oldPath, newPath)')).toBe(true)
  })

  it("detects appendFileSync", () => {
    expect(pattern.test('appendFileSync(logFile, line)')).toBe(true)
  })

  it("detects with fs. prefix", () => {
    expect(pattern.test('fs.readFileSync("file.txt")')).toBe(true)
  })

  it("does not match async readFile", () => {
    expect(pattern.test('await readFile("file.txt")')).toBe(false)
  })

  it("does not match Effect fs.readFileString", () => {
    expect(pattern.test('yield* fs.readFileString("file.txt")')).toBe(false)
  })

  it("does not match comment mentioning sync", () => {
    expect(pattern.test("// avoid using readFileSync")).toBe(false)
  })
})
