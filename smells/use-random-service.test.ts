import { describe, expect, it } from "vitest"

const pattern = /Math\.random\(\)/

describe("use-random-service smell", () => {
  it("detects Math.random()", () => {
    expect(pattern.test("const r = Math.random()")).toBe(true)
  })

  it("detects Math.random() in expressions", () => {
    expect(pattern.test("const dice = Math.floor(Math.random() * 6)")).toBe(true)
  })

  it("detects Math.random() in comparisons", () => {
    expect(pattern.test("if (Math.random() > 0.5)")).toBe(true)
  })

  it("does not match Random.next", () => {
    expect(pattern.test("yield* Random.next")).toBe(false)
  })

  it("does not match Random.nextInt", () => {
    expect(pattern.test("yield* Random.nextIntBetween(0, 100)")).toBe(false)
  })

  it("does not match Math.floor()", () => {
    expect(pattern.test("Math.floor(42.7)")).toBe(false)
  })

  it("does not match Math.round()", () => {
    expect(pattern.test("Math.round(3.14)")).toBe(false)
  })
})
