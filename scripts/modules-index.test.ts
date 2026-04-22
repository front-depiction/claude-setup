import { describe, it, expect } from "vitest"
import { Effect, pipe } from "effect"
import { BunContext } from "@effect/platform-bun"
import { buildModulesIndex, extractFirstParagraph, type ModulesIndexOptions } from "./modules-index.js"
import { Option } from "effect"

const FIXTURES = `${import.meta.dir}/../__tests__/fixtures/modules-index`

const run = <A>(effect: Effect.Effect<A, unknown, never>): Promise<A> =>
  pipe(effect, Effect.runPromise)

const MINIMAL_EXCLUDES = ["node_modules", ".git"]

const buildIndex = (
  rootDir: string,
  extra?: Partial<ModulesIndexOptions>
): Effect.Effect<string, unknown, never> =>
  buildModulesIndex({
    rootDir,
    excludePatterns: MINIMAL_EXCLUDES,
    ...extra,
  }).pipe(Effect.provide(BunContext.layer))

describe("modules-index", () => {
  describe("extractFirstParagraph (pure)", () => {
    it("extracts prose after a heading", () => {
      const content = "# My Package\n\nFirst prose paragraph here.\nSecond line of paragraph.\n\n## Section\n\nOther content."
      const result = extractFirstParagraph(content)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrElse(result, () => "")).toContain("First prose paragraph here.")
      expect(Option.getOrElse(result, () => "")).toContain("Second line of paragraph.")
    })

    it("extracts prose from file with no heading", () => {
      const content = "No heading here, paragraph starts immediately.\nSecond line.\n"
      const result = extractFirstParagraph(content)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrElse(result, () => "")).toContain("No heading here")
    })

    it("stops at blank line boundary", () => {
      const content = "# Heading\n\nFirst paragraph line.\n\nSecond paragraph - should NOT appear."
      const result = extractFirstParagraph(content)
      const text = Option.getOrElse(result, () => "")
      expect(text).toContain("First paragraph line.")
      expect(text).not.toContain("Second paragraph")
    })

    it("handles heading immediately followed by prose (no blank line)", () => {
      const content = "# Heading\nProse immediately after heading.\n"
      const result = extractFirstParagraph(content)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrElse(result, () => "")).toContain("Prose immediately after heading.")
    })

    it("returns None for heading-only content", () => {
      const content = "# Just a heading\n## Another heading\n"
      const result = extractFirstParagraph(content)
      expect(Option.isNone(result)).toBe(true)
    })

    it("returns None for empty content", () => {
      const result = extractFirstParagraph("")
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("framing message", () => {
    it("appears at top of output", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          expect(output.startsWith("The list below is the AIREADME first-paragraph")).toBe(true)
        })
      )
    )

    it("includes instruction to use as index", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          expect(output).toContain("Use this as an index to decide which full AIREADME.md to Read next.")
        })
      )
    )
  })

  describe("AIREADME-bearing packages", () => {
    it("with-all appears with first paragraph", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          expect(output).toContain("## packages/with-all")
          expect(output).toContain("This package has all three documentation files.")
        })
      )
    )

    it("with-all has Read more pointer to AIREADME.md", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          expect(output).toContain("Read more: packages/with-all/AIREADME.md")
        })
      )
    )

    it("with-all Also available lists ONTOLOGY.md and INVARIANTS.md", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          // Find the with-all section
          const lines = output.split("\n")
          const sectionStart = lines.findIndex(l => l === "## packages/with-all")
          const sectionEnd = lines.findIndex((l, i) => i > sectionStart && l.startsWith("## "))
          const section = lines.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd).join("\n")
          expect(section).toContain("Also available:")
          expect(section).toContain("ONTOLOGY.md")
          expect(section).toContain("INVARIANTS.md")
        })
      )
    )

    it("aireadme-only has no Also available line", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          const lines = output.split("\n")
          const sectionStart = lines.findIndex(l => l === "## packages/aireadme-only")
          const sectionEnd = lines.findIndex((l, i) => i > sectionStart && l.startsWith("## "))
          const section = lines.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd).join("\n")
          expect(section).not.toContain("Also available:")
        })
      )
    )

    it("bare AIREADME (no heading) extracts prose correctly", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          expect(output).toContain("No heading here, paragraph starts immediately.")
        })
      )
    )
  })

  describe("ONTOLOGY-only package (no AIREADME)", () => {
    it("ontology-only appears with no-AIREADME placeholder", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          expect(output).toContain("## packages/ontology-only")
          expect(output).toContain("(no AIREADME; ontology-only)")
        })
      )
    )

    it("ontology-only has Read more pointer to ONTOLOGY.md", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          const lines = output.split("\n")
          const sectionStart = lines.findIndex(l => l === "## packages/ontology-only")
          const sectionEnd = lines.findIndex((l, i) => i > sectionStart && l.startsWith("## "))
          const section = lines.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd).join("\n")
          expect(section).toContain("Read more: packages/ontology-only/ONTOLOGY.md")
        })
      )
    )

    it("ontology-only Also available lists ONTOLOGY.md", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          const lines = output.split("\n")
          const sectionStart = lines.findIndex(l => l === "## packages/ontology-only")
          const sectionEnd = lines.findIndex((l, i) => i > sectionStart && l.startsWith("## "))
          const section = lines.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd).join("\n")
          expect(section).toContain("Also available: ONTOLOGY.md")
        })
      )
    )
  })

  describe("alphabetical sort order", () => {
    it("packages appear in alphabetical order by path", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-a`)
          const sectionHeaders = output
            .split("\n")
            .filter(l => l.startsWith("## "))
            .map(l => l.slice(3))

          const sorted = [...sectionHeaders].sort()
          expect(sectionHeaders).toEqual(sorted)
        })
      )
    )
  })

  describe("exclusion", () => {
    it("packages in node_modules are excluded", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildIndex(`${FIXTURES}/repo-exclude`)
          expect(output).toContain("packages/real")
          expect(output).not.toContain("node_modules/fake")
          expect(output).not.toContain("This should be excluded")
        })
      )
    )
  })
})
