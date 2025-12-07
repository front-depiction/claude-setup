import { describe, expect, it } from "vitest"

const pattern = /@ts-(ignore|expect-error)/

describe("avoid-ts-ignore smell", () => {
  it("detects @ts-ignore", () => {
    expect(pattern.test("// @ts-ignore")).toBe(true)
  })

  it("detects @ts-expect-error", () => {
    expect(pattern.test("// @ts-expect-error")).toBe(true)
  })

  it("detects @ts-ignore without comment slashes", () => {
    expect(pattern.test("@ts-ignore")).toBe(true)
  })

  it("detects @ts-expect-error with explanation", () => {
    expect(pattern.test("// @ts-expect-error: TODO fix this later")).toBe(true)
  })

  it("does not match @ts-check", () => {
    expect(pattern.test("// @ts-check")).toBe(false)
  })

  it("does not match @ts-nocheck", () => {
    expect(pattern.test("// @ts-nocheck")).toBe(false)
  })

  it("does not match regular comments", () => {
    expect(pattern.test("// This is a regular comment about typescript")).toBe(false)
  })
})
