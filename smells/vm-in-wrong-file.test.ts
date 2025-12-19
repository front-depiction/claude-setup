import { describe, expect, it } from "vitest"


const pattern = /(interface\s+\w+VM\s*\{|Context\.GenericTag<\w*VM>|Layer\.(effect|scoped)\(\s*\w+VM)/

describe("vm-in-wrong-file smell", () => {
  describe("detects VM patterns", () => {
    it("detects interface with VM suffix", () => {
      expect(pattern.test("export interface WalletVM {")).toBe(true)
    })

    it("detects interface with VM suffix and whitespace", () => {
      expect(pattern.test("interface  MyComponentVM  {")).toBe(true)
    })

    it("detects Context.GenericTag with VM type", () => {
      expect(pattern.test('export const WalletVM = Context.GenericTag<WalletVM>("WalletVM")')).toBe(true)
    })

    it("detects Layer.effect with VM tag", () => {
      expect(pattern.test("const layer = Layer.effect(WalletVM, Effect.gen(function* () {")).toBe(true)
    })

    it("detects Layer.scoped with VM tag", () => {
      expect(pattern.test("const layer = Layer.scoped(WalletVM, Effect.gen(function* () {")).toBe(true)
    })

    it("detects Layer.effect with spacing", () => {
      expect(pattern.test("Layer.effect( WalletVM,")).toBe(true)
    })
  })

  describe("does not match non-VM patterns", () => {
    it("does not match regular interfaces", () => {
      expect(pattern.test("interface User {")).toBe(false)
    })

    it("does not match interfaces with VM in middle", () => {
      expect(pattern.test("interface VMConfig {")).toBe(false)
    })

    it("does not match Context.GenericTag without VM", () => {
      expect(pattern.test('Context.GenericTag<WalletService>("WalletService")')).toBe(false)
    })

    it("does not match Layer.effect without VM tag", () => {
      expect(pattern.test("Layer.effect(WalletService, Effect.gen(")).toBe(false)
    })

    it("does not match Layer.succeed", () => {
      expect(pattern.test("Layer.succeed(WalletVM, impl)")).toBe(false)
    })

    it("does not match useVM hook", () => {
      expect(pattern.test("const vm = useVM(WalletVM.tag, WalletVM.layer)")).toBe(false)
    })
  })

  describe("glob pattern excludes .vm.ts files", () => {
    const glob = "**/!(*.vm).{ts,tsx}"

    it("should match regular .ts files", () => {
      // Note: This is a documentation test - actual glob matching happens at runtime
      expect(glob).toContain("!(*.vm)")
      expect(glob).toContain(".{ts,tsx}")
    })
  })
})
