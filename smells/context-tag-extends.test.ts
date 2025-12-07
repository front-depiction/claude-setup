import { describe, expect, it } from "vitest"

const pattern = /class\s+\w+Tag\s+extends\s+Context\.Tag/

describe("context-tag-extends smell", () => {
  it("detects class with Tag suffix extending Context.Tag", () => {
    expect(pattern.test("class MyServiceTag extends Context.Tag")).toBe(true)
  })

  it("detects class with Tag suffix and type parameters", () => {
    expect(pattern.test("class DatabaseTag extends Context.Tag<Database>()")).toBe(true)
  })

  it("detects various Tag naming patterns", () => {
    expect(pattern.test("class UserServiceTag extends Context.Tag")).toBe(true)
    expect(pattern.test("class ApiTag extends Context.Tag")).toBe(true)
    expect(pattern.test("class ConfigTag extends Context.Tag")).toBe(true)
  })

  it("does not match interface + GenericTag pattern", () => {
    expect(pattern.test("const MyService = Context.GenericTag<MyService>('MyService')")).toBe(false)
  })

  it("does not match class without Tag suffix", () => {
    expect(pattern.test("class MyService extends Context.Tag")).toBe(false)
  })

  it("does not match service interface definitions", () => {
    expect(pattern.test("interface MyService { readonly doSomething: () => void }")).toBe(false)
  })

  it("does not match Layer definitions", () => {
    expect(pattern.test("const LiveMyService = Layer.succeed(MyService, {})")).toBe(false)
  })
})
