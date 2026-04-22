import { describe, it, expect } from "vitest"
import { Effect, pipe } from "effect"
import { BunContext } from "@effect/platform-bun"
import { buildHotTree, type HotTreeOptions, type Annotation } from "./hot-tree.js"

const FIXTURES = `${import.meta.dir}/../__tests__/fixtures/hot-tree`

const run = <A>(effect: Effect.Effect<A, unknown, never>): Promise<A> =>
  pipe(effect, Effect.runPromise)

const MINIMAL_EXCLUDES = ["node_modules", ".git"]

const buildWithOverride = (
  rootDir: string,
  override: Map<string, Annotation>,
  extra?: Partial<HotTreeOptions>
): Effect.Effect<string, unknown, never> =>
  buildHotTree({
    rootDir,
    hotnessOverride: override,
    excludePatterns: MINIMAL_EXCLUDES,
    ...extra,
  }).pipe(Effect.provide(BunContext.layer))

const repoBasic = `${FIXTURES}/repo-basic`

const basicOverride = new Map<string, Annotation>([
  ["hot-pkg", { commits: 20, authors: 1 }],
  ["warm-pkg", { commits: 3, authors: 1 }],
  ["cold-pkg", { commits: 0, authors: 0 }],
  ["another-warm", { commits: 1, authors: 1 }],
])

describe("hot-tree", () => {
  describe("legend", () => {
    it("output starts with legend line before the root dir", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride)
          const lines = output.split("\n")
          expect(lines[0]).toMatch(/^# Legend:/)
          expect(lines[1]).toMatch(/repo-basic\/$/)
        })
      )
    )
  })

  describe("discovery", () => {
    it("finds all 4 top-level dirs in repo-basic", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride)
          expect(output).toContain("hot-pkg/")
          expect(output).toContain("warm-pkg/")
          expect(output).toContain("cold-pkg/")
          expect(output).toContain("another-warm/")
        })
      )
    )
  })

  describe("classification", () => {
    it("hot-pkg is hot, cold-pkg is cold, others are warm given the override", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride)
          // hot-pkg should have commit annotation
          expect(output).toMatch(/hot-pkg\/.*\(20c/)
          // cold-pkg should have NO annotation (0 commits)
          const coldLine = output.split("\n").find(l => l.includes("cold-pkg/"))
          expect(coldLine).toBeDefined()
          expect(coldLine).not.toContain("(")
          // warm dirs get annotation but just commits
          expect(output).toMatch(/warm-pkg\/.*\(3c/)
          expect(output).toMatch(/another-warm\/.*\(1c/)
        })
      )
    )

    it("hot-pkg depth=2 shows nested-deep/ but NOT inner/", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride)
          expect(output).toContain("nested-deep/")
          expect(output).not.toContain("inner/")
        })
      )
    )

    it("hot-pkg depth=2 does NOT show individual files like deeper.ts", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride)
          expect(output).not.toContain("deeper.ts")
        })
      )
    )

    it("cold-pkg depth=1 — only the top-level dir appears, src/ does not", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride)
          const lines = output.split("\n")
          const coldIdx = lines.findIndex(l => l.includes("cold-pkg/"))
          expect(coldIdx).toBeGreaterThanOrEqual(0)
          expect(output).not.toContain("cold-pkg/\n    └── src/")
          expect(output).not.toContain("cold-pkg/\n│   └── src/")
        })
      )
    )

    it("warm depth=1 — warm-pkg/src/ does NOT appear (baseDepth=1 means no children for warm)", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride)
          // With baseDepth=1, warm dirs show no children
          expect(output).not.toContain("s.ts")
          // warm-pkg itself is still listed
          expect(output).toContain("warm-pkg/")
        })
      )
    )

    it("explicit baseDepth=2 restores old warm depth — warm-pkg/src/ appears", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride, { baseDepth: 2 })
          expect(output).toContain("src/")
          expect(output).not.toContain("s.ts")
        })
      )
    )
  })

  describe("annotations", () => {
    it("commit count appears for hot-pkg", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildWithOverride(repoBasic, basicOverride)
          expect(output).toMatch(/hot-pkg\/.*\(20c/)
        })
      )
    )

    it("author annotation appears only when authors > 1", () =>
      run(
        Effect.gen(function* () {
          const multiAuthorOverride = new Map<string, Annotation>([
            ["hot-pkg", { commits: 20, authors: 3 }],
            ["warm-pkg", { commits: 3, authors: 1 }],
            ["cold-pkg", { commits: 0, authors: 0 }],
            ["another-warm", { commits: 1, authors: 1 }],
          ])
          const output = yield* buildWithOverride(repoBasic, multiAuthorOverride)
          // hot-pkg has 3 authors → should show (20c, 3a)
          expect(output).toMatch(/hot-pkg\/.*\(20c, 3a\)/)
          // warm-pkg has 1 author → should NOT show author count
          const warmLine = output.split("\n").find(l => l.includes("warm-pkg/"))
          expect(warmLine).not.toContain(", ")
        })
      )
    )
  })

  describe("exclusions", () => {
    it("node_modules inside a package is excluded from output", () =>
      run(
        Effect.gen(function* () {
          const output = yield* buildHotTree({
            rootDir: `${FIXTURES}/repo-exclude`,
            hotnessOverride: new Map([["packages", { commits: 5, authors: 1 }]]),
            excludePatterns: ["node_modules", ".git"],
          }).pipe(Effect.provide(BunContext.layer))
          expect(output).toContain("real/")
          expect(output).not.toContain("fake")
          expect(output).not.toContain("node_modules")
        })
      )
    )
  })

  describe("submodule awareness via hotnessOverride", () => {
    it("submodule contributions in hotnessOverride are treated like any other dir", () =>
      run(
        Effect.gen(function* () {
          const overrideWithSub = new Map<string, Annotation>([
            ["hot-pkg", { commits: 20, authors: 1 }],
            ["warm-pkg", { commits: 0, authors: 0 }],
            ["cold-pkg", { commits: 0, authors: 0 }],
            ["another-warm", { commits: 0, authors: 0 }],
          ])
          const output = yield* buildWithOverride(repoBasic, overrideWithSub)
          // hot-pkg is hot, others are cold
          expect(output).toMatch(/hot-pkg\/.*\(20c/)
          const warmLine = output.split("\n").find(l => l.includes("warm-pkg/"))
          expect(warmLine).toBeDefined()
          expect(warmLine).not.toContain("(")
        })
      )
    )
  })

  describe("quantile edge cases", () => {
    it("single non-zero dir is classified as hot (top quartile of 1)", () =>
      run(
        Effect.gen(function* () {
          const singleHotOverride = new Map<string, Annotation>([
            ["hot-pkg", { commits: 5, authors: 1 }],
            ["warm-pkg", { commits: 0, authors: 0 }],
            ["cold-pkg", { commits: 0, authors: 0 }],
            ["another-warm", { commits: 0, authors: 0 }],
          ])
          const output = yield* buildWithOverride(repoBasic, singleHotOverride)
          // hot-pkg should be classified hot → shows annotation
          expect(output).toMatch(/hot-pkg\/.*\(5c/)
          // baseDepth=1, hot=2 → nested-deep/ appears, inner/ does not
          expect(output).toContain("nested-deep/")
          expect(output).not.toContain("inner/")
        })
      )
    )

    it("fully cold repo — every top-level is just a dir name with no annotation", () =>
      run(
        Effect.gen(function* () {
          const allColdOverride = new Map<string, Annotation>([
            ["hot-pkg", { commits: 0, authors: 0 }],
            ["warm-pkg", { commits: 0, authors: 0 }],
            ["cold-pkg", { commits: 0, authors: 0 }],
            ["another-warm", { commits: 0, authors: 0 }],
          ])
          const output = yield* buildWithOverride(repoBasic, allColdOverride)
          // All dirs appear but none have annotations
          expect(output).toContain("hot-pkg/")
          expect(output).toContain("warm-pkg/")
          expect(output).toContain("cold-pkg/")
          expect(output).toContain("another-warm/")
          // No dir annotations at all (legend line is excluded from check)
          const dirLines = output.split("\n").filter(l => !l.startsWith("# Legend:"))
          expect(dirLines.join("\n")).not.toContain("(0c)")
          expect(dirLines.join("\n")).not.toContain("(")
        })
      )
    )
  })
})
