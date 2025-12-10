import { describe, expect, it } from "vitest"

const pattern = /\._tag\s*===\s*["']/

describe("avoid-direct-tag-checks smell", () => {
  describe("detects direct _tag checks", () => {
    it("detects _tag === with double quotes", () => {
      expect(pattern.test('if (e._tag === "FactRecorded")')).toBe(true)
    })

    it("detects _tag === with single quotes", () => {
      expect(pattern.test("if (e._tag === 'FactRecorded')")).toBe(true)
    })

    it("detects _tag === with spacing", () => {
      expect(pattern.test('e._tag  ===  "SomeTag"')).toBe(true)
    })

    it("detects nested property _tag checks", () => {
      expect(pattern.test('event.data._tag === "Created"')).toBe(true)
    })

    it("detects in ternary expressions", () => {
      expect(pattern.test('result._tag === "Success" ? ok : err')).toBe(true)
    })

    it("detects in switch case conditions", () => {
      expect(pattern.test('case value._tag === "Option":')).toBe(true)
    })
  })

  describe("safe patterns (should not match)", () => {
    it("does not match $is predicate usage", () => {
      expect(pattern.test('$is("FactRecorded")(event)')).toBe(false)
    })

    it("does not match $match usage", () => {
      expect(pattern.test('$match({ FactRecorded: handle })')).toBe(false)
    })

    it("does not match custom predicate", () => {
      expect(pattern.test("isFactRecorded(event)")).toBe(false)
    })

    it("does not match _tag property access without comparison", () => {
      expect(pattern.test("console.log(e._tag)")).toBe(false)
    })

    it("does not match tag without underscore", () => {
      expect(pattern.test('tag === "Something"')).toBe(false)
    })

    it("does not match _tag !== checks (different operator)", () => {
      expect(pattern.test('e._tag !== "Error"')).toBe(false)
    })
  })
})
