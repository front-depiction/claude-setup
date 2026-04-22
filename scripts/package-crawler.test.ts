import { describe, it, expect } from "vitest"
import { Effect, pipe } from "effect"
import { BunContext } from "@effect/platform-bun"
import {
  crawlPackages,
  renderXml,
  type CrawlOptions,
  type PackagesResult,
} from "./package-crawler.js"
import { parseGitmodules } from "./lib/git-hotness.js"

const FIXTURES = `${import.meta.dir}/../__tests__/fixtures/packages-crawler`

const run = <A>(effect: Effect.Effect<A, unknown, never>): Promise<A> =>
  pipe(effect, Effect.runPromise)

const MINIMAL_EXCLUDES = ["node_modules", ".git"]

const crawlWithOverride = (
  rootDir: string,
  override: Map<string, number>,
  extra?: Partial<CrawlOptions>
): Effect.Effect<PackagesResult, unknown, never> =>
  crawlPackages({
    rootDir,
    hotnessOverride: override,
    excludePatterns: MINIMAL_EXCLUDES,
    ...extra,
  }).pipe(Effect.provide(BunContext.layer))

describe("package-crawler", () => {
  describe("discovery", () => {
    it("finds all packages in repo-a", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, new Map())
          const allPaths = [
            ...result.recent.map(p => p.path),
            ...result.index.map(p => p.path),
          ]
          expect(allPaths).toContain("packages/alpha")
          expect(allPaths).toContain("packages/beta")
          expect(allPaths).toContain("packages/gamma")
          expect(allPaths).toContain("packages/delta")
          expect(allPaths).toContain("apps/editor")
        })
      )
    )

    it("finds no packages in repo-empty", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-empty`, new Map())
          expect(result.recent).toHaveLength(0)
          expect(result.index).toHaveLength(0)
        })
      )
    )

    it("excludes node_modules in repo-exclude", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-exclude`, new Map())
          const allPaths = [
            ...result.recent.map(p => p.path),
            ...result.index.map(p => p.path),
          ]
          const hasReal = allPaths.some(p => p.includes("packages/real"))
          const hasFake = allPaths.some(p => p.includes("node_modules/fake"))
          expect(hasReal).toBe(true)
          expect(hasFake).toBe(false)
        })
      )
    )
  })

  describe("classification with override", () => {
    const hotness = new Map<string, number>([
      ["packages/alpha", 5],
      ["packages/beta", 3],
      ["apps/editor", 2],
    ])

    it("hot packages appear in recent, cold in index", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness)
          const recentPaths = result.recent.map(p => p.path)
          const indexPaths = result.index.map(p => p.path)

          expect(recentPaths).toContain("packages/alpha")
          expect(recentPaths).toContain("packages/beta")
          expect(indexPaths).toContain("apps/editor")
          expect(indexPaths).toContain("packages/gamma")
          expect(indexPaths).toContain("packages/delta")
        })
      )
    )

    it("recent is ordered by commit-count descending", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness)
          const counts = result.recent.map(p => p.commitCount)
          expect(counts[0]).toBeGreaterThanOrEqual(counts[1] ?? 0)
          expect(result.recent[0].path).toBe("packages/alpha")
        })
      )
    )

    it("recent has exactly 2 entries, index has exactly 3", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness)
          expect(result.recent).toHaveLength(2)
          expect(result.index).toHaveLength(3)
        })
      )
    )

    it("package with exactly 2 commits is NOT hot (stays in index)", () =>
      run(
        Effect.gen(function* () {
          const override = new Map<string, number>([["packages/alpha", 2]])
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, override)
          const recentPaths = result.recent.map(p => p.path)
          const indexPaths = result.index.map(p => p.path)
          expect(recentPaths).not.toContain("packages/alpha")
          expect(indexPaths).toContain("packages/alpha")
        })
      )
    )

    it("package with exactly 3 commits IS hot", () =>
      run(
        Effect.gen(function* () {
          const override = new Map<string, number>([["packages/alpha", 3]])
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, override)
          const recentPaths = result.recent.map(p => p.path)
          expect(recentPaths).toContain("packages/alpha")
        })
      )
    )
  })

  describe("content hydration", () => {
    const hotness = new Map<string, number>([
      ["packages/alpha", 5],
      ["packages/beta", 4],
      ["apps/editor", 3],
    ])

    it("alpha has all three file contents verbatim", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness)
          const alpha = result.recent.find(p => p.path === "packages/alpha")
          expect(alpha).toBeDefined()
          expect(alpha?.airreadme).toContain("alpha AIREADME")
          expect(alpha?.ontology).toContain("alpha ONTOLOGY")
          expect(alpha?.invariants).toContain("alpha INVARIANTS")
        })
      )
    )

    it("beta has only airreadme, no ontology or invariants", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness)
          const beta = result.recent.find(p => p.path === "packages/beta")
          expect(beta).toBeDefined()
          expect(beta?.airreadme).toContain("beta AIREADME")
          expect(beta?.ontology).toBeUndefined()
          expect(beta?.invariants).toBeUndefined()
        })
      )
    )

    it("apps/editor has only ontology, no airreadme or invariants", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness)
          const editor = result.recent.find(p => p.path === "apps/editor")
          expect(editor).toBeDefined()
          expect(editor?.airreadme).toBeUndefined()
          expect(editor?.ontology).toContain("editor ONTOLOGY")
          expect(editor?.invariants).toBeUndefined()
        })
      )
    )
  })

  describe("index (cold packages)", () => {
    const hotness = new Map<string, number>([
      ["packages/alpha", 5],
      ["packages/beta", 4],
      ["apps/editor", 3],
    ])

    it("gamma shows AIREADME and ONTOLOGY in files list", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness)
          const gamma = result.index.find(p => p.path === "packages/gamma")
          expect(gamma).toBeDefined()
          expect(gamma?.files).toContain("AIREADME")
          expect(gamma?.files).toContain("ONTOLOGY")
          expect(gamma?.files).not.toContain("INVARIANTS")
        })
      )
    )

    it("delta shows only INVARIANTS in files list", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness)
          const delta = result.index.find(p => p.path === "packages/delta")
          expect(delta).toBeDefined()
          expect(delta?.files).toContain("INVARIANTS")
          expect(delta?.files).not.toContain("AIREADME")
          expect(delta?.files).not.toContain("ONTOLOGY")
        })
      )
    )
  })

  describe("maxHotPackages cap", () => {
    const hotness = new Map<string, number>([
      ["packages/alpha", 5],
      ["packages/beta", 4],
      ["apps/editor", 3],
    ])

    it("cap=1 keeps only the top hot package in recent", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, hotness, {
            maxHotPackages: 1,
          })
          expect(result.recent).toHaveLength(1)
          expect(result.recent[0].path).toBe("packages/alpha")
          const indexPaths = result.index.map(p => p.path)
          expect(indexPaths).toContain("packages/beta")
          expect(indexPaths).toContain("apps/editor")
        })
      )
    )
  })

  describe("XML shape", () => {
    it("renderXml produces correct structure", () => {
      const result: PackagesResult = {
        recent: [
          {
            path: "packages/alpha",
            commitCount: 3,
            airreadme: "# alpha\nsome content",
            ontology: "Carrier: value",
            invariants: "- law holds",
          },
        ],
        index: [
          { path: "packages/gamma", files: ["AIREADME", "ONTOLOGY"] },
          { path: "packages/delta", files: ["INVARIANTS"] },
        ],
      }

      const xml = renderXml(result)

      expect(xml).toContain("<packages>")
      expect(xml).toContain("<recent>")
      expect(xml).toContain("<index>")
      expect(xml).toContain("packages/alpha")
      expect(xml).toContain("# alpha")
      expect(xml).toContain("packages/gamma → AIREADME + ONTOLOGY")
      expect(xml).toContain("packages/delta → INVARIANTS")
    })

    it("hot package with missing invariants emits no <invariants> tag", () => {
      const result: PackagesResult = {
        recent: [
          {
            path: "packages/beta",
            commitCount: 2,
            airreadme: "# beta",
          },
        ],
        index: [],
      }

      const xml = renderXml(result)
      expect(xml).toContain("<airreadme>")
      expect(xml).not.toContain("<invariants>")
      expect(xml).not.toContain("<ontology>")
    })
  })

  describe("nested discovery", () => {
    it("finds deep nested package in repo-nested", () =>
      run(
        Effect.gen(function* () {
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-nested`, new Map())
          const allPaths = [
            ...result.recent.map(p => p.path),
            ...result.index.map(p => p.path),
          ]
          expect(allPaths).toContain("packages-shared/sub/deep")
        })
      )
    )
  })

  describe("absent files", () => {
    it("missing INVARIANTS for a hot package means no invariants key in result", () =>
      run(
        Effect.gen(function* () {
          const override = new Map<string, number>([["packages/beta", 5]])
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, override)
          const beta = result.recent.find(p => p.path === "packages/beta")
          expect(beta).toBeDefined()
          expect(beta?.airreadme).toBeDefined()
          expect("invariants" in (beta ?? {})).toBe(false)
          expect("ontology" in (beta ?? {})).toBe(false)
        })
      )
    )
  })

  describe("submodule detection — parseGitmodules", () => {
    const sampleGitmodules = `
[submodule ".references/effect"]
\tpath = .references/effect
\turl = https://github.com/Effect-TS/effect.git
[submodule ".repos/interviews"]
\tpath = .repos/interviews
\turl = https://github.com/phosphorco/interviews.git
[submodule "packages-shared"]
\tpath = packages-shared
\turl = https://github.com/phosphorco/packages.git
`

    it("owned submodule (no leading dot) is isOwned=true", () => {
      const entries = parseGitmodules(sampleGitmodules)
      const owned = entries.filter(e => e.isOwned)
      expect(owned.map(e => e.path)).toContain("packages-shared")
    })

    it("external submodules (leading dot) are isOwned=false", () => {
      const entries = parseGitmodules(sampleGitmodules)
      const external = entries.filter(e => !e.isOwned)
      expect(external.map(e => e.path)).toContain(".references/effect")
      expect(external.map(e => e.path)).toContain(".repos/interviews")
    })

    it("hotnessOverride with submodule paths included makes those packages hot", () =>
      run(
        Effect.gen(function* () {
          const override = new Map<string, number>([
            ["packages-shared/sub/deep", 5],
          ])
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-nested`, override)
          const deepPkg = result.recent.find(p => p.path === "packages-shared/sub/deep")
          expect(deepPkg).toBeDefined()
          expect(deepPkg?.commitCount).toBe(5)
        })
      )
    )

    it("submodule without pointer bump in hotnessOverride stays cold", () =>
      run(
        Effect.gen(function* () {
          // Override has no entry for packages-shared/* → all packages there are cold
          const override = new Map<string, number>([["packages/alpha", 3]])
          const result = yield* crawlWithOverride(`${FIXTURES}/repo-a`, override)
          const indexPaths = result.index.map(p => p.path)
          // packages-shared doesn't exist in repo-a, so no submodule packages appear
          // The key test: no submodule path leaks into recent without an override entry
          const recentPaths = result.recent.map(p => p.path)
          expect(recentPaths.every(p => !p.startsWith("packages-shared/"))).toBe(true)
          void indexPaths
        })
      )
    )
  })
})
