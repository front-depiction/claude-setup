#!/usr/bin/env bun
/**
 * Modules Index
 *
 * Enumerates all AIREADME-bearing packages with first-paragraph summaries
 * and read-more pointers. Output is plain text for direct agent consumption.
 *
 * @category Scripts
 * @since 1.0.0
 */

import { BunContext, BunRuntime } from "@effect/platform-bun"
import { FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array, Console, Effect, Option, Order, pipe, String } from "effect"

// ============================================================================
// Types
// ============================================================================

export type AiFile = "AIREADME" | "ONTOLOGY" | "INVARIANTS"

export interface DiscoveredPackage {
  readonly path: string
  readonly files: ReadonlyArray<AiFile>
}

export interface IndexEntry {
  readonly path: string
  readonly firstParagraph: Option.Option<string>
  readonly hasAireadme: boolean
  readonly hasOntology: boolean
  readonly hasInvariants: boolean
}

export interface ModulesIndexOptions {
  readonly rootDir: string
  readonly excludePatterns?: ReadonlyArray<string>
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_EXCLUDE = [
  "node_modules",
  ".git",
  "dist",
  ".turbo",
  "build",
  ".next",
  ".cache",
  "coverage",
  "__tests__",
  "__archive__",
]

const AI_FILES = ["AIREADME.md", "ONTOLOGY.md", "INVARIANTS.md"] as const

// ============================================================================
// Discovery
// ============================================================================

const discoverPackages = (
  rootDir: string,
  excludePatterns: ReadonlyArray<string>
): Effect.Effect<
  ReadonlyArray<DiscoveredPackage>,
  PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathModule = yield* Path.Path

    const excludeSet = new Set(excludePatterns)

    const searchDir = (
      dir: string
    ): Effect.Effect<
      Array<DiscoveredPackage>,
      PlatformError,
      FileSystem.FileSystem | Path.Path
    > =>
      Effect.gen(function* () {
        const entries = yield* Effect.orElseSucceed(
          fs.readDirectory(dir),
          () => Array.empty<string>()
        )

        const presentFiles: AiFile[] = []
        for (const name of AI_FILES) {
          const full = pathModule.join(dir, name)
          const exists = yield* Effect.orElseSucceed(fs.exists(full), () => false)
          if (exists) {
            presentFiles.push(name.replace(".md", "") as AiFile)
          }
        }

        const relPath = dir === rootDir ? "." : dir.slice(rootDir.length + 1)

        const thisPackage: Array<DiscoveredPackage> =
          presentFiles.length > 0
            ? [{ path: relPath, files: presentFiles }]
            : []

        const childResults = yield* pipe(
          entries,
          Array.map(entry => {
            if (excludeSet.has(entry))
              return Effect.succeed(Array.empty<DiscoveredPackage>())
            const fullPath = pathModule.join(dir, entry)
            return fs.stat(fullPath).pipe(
              Effect.flatMap(stat =>
                stat.type === "Directory"
                  ? Effect.suspend(() => searchDir(fullPath))
                  : Effect.succeed(Array.empty<DiscoveredPackage>())
              ),
              Effect.orElseSucceed(() => Array.empty<DiscoveredPackage>())
            )
          }),
          Effect.all,
          Effect.map(Array.flatten)
        )

        return [...thisPackage, ...childResults]
      })

    return yield* searchDir(rootDir)
  })

// ============================================================================
// First paragraph extraction
// ============================================================================

/**
 * Extract first prose paragraph from markdown.
 *
 * Skips all leading heading lines (starting with #) and blank lines.
 * Collects lines from the first non-heading, non-blank line until the
 * next blank line (paragraph boundary).
 */
export const extractFirstParagraph = (content: string): Option.Option<string> => {
  const lines = content.split("\n")

  let inParagraph = false
  const paragraphLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!inParagraph) {
      // Skip headings and blank lines to find paragraph start
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue
      // First prose line — start collecting
      inParagraph = true
      paragraphLines.push(trimmed)
    } else {
      // Inside paragraph — blank line ends it
      if (trimmed.length === 0) break
      paragraphLines.push(trimmed)
    }
  }

  if (paragraphLines.length === 0) return Option.none()
  return Option.some(paragraphLines.join(" "))
}

// ============================================================================
// Hydration
// ============================================================================

const readFileOptional = (
  fullPath: string
): Effect.Effect<Option.Option<string>, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* Effect.orElseSucceed(fs.exists(fullPath), () => false)
    if (!exists) return Option.none()
    const content = yield* fs.readFileString(fullPath)
    return Option.some(content)
  })

const hydrateEntry = (
  rootDir: string,
  pkg: DiscoveredPackage
): Effect.Effect<IndexEntry, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const base = `${rootDir}/${pkg.path}`

    const aireadmeContent = pkg.files.includes("AIREADME")
      ? yield* readFileOptional(`${base}/AIREADME.md`)
      : Option.none<string>()

    const firstParagraph = pipe(
      aireadmeContent,
      Option.flatMap(extractFirstParagraph)
    )

    return {
      path: pkg.path,
      firstParagraph,
      hasAireadme: pkg.files.includes("AIREADME"),
      hasOntology: pkg.files.includes("ONTOLOGY"),
      hasInvariants: pkg.files.includes("INVARIANTS"),
    }
  })

// ============================================================================
// Rendering
// ============================================================================

const renderEntry = (entry: IndexEntry, rootDir: string): string => {
  const relativePath = entry.path

  const lines: string[] = []

  lines.push(`## ${relativePath}`)

  if (entry.hasAireadme) {
    const paragraph = pipe(
      entry.firstParagraph,
      Option.getOrElse(() => "(no summary available)")
    )
    lines.push(paragraph)
    lines.push(`Read more: ${relativePath}/AIREADME.md`)
  } else {
    lines.push("(no AIREADME; ontology-only)")
    const existing = [
      entry.hasOntology ? `${relativePath}/ONTOLOGY.md` : null,
      entry.hasInvariants ? `${relativePath}/INVARIANTS.md` : null,
    ].filter(Boolean)
    if (existing.length > 0) {
      lines.push(`Read more: ${existing[0]}`)
    }
  }

  const alsoAvailable = [
    entry.hasOntology ? "ONTOLOGY.md" : null,
    entry.hasInvariants ? "INVARIANTS.md" : null,
  ].filter(Boolean)

  if (alsoAvailable.length > 0) {
    lines.push(`Also available: ${alsoAvailable.join(" · ")}`)
  }

  return lines.join("\n")
}

const FRAMING_MESSAGE = `The list below is the AIREADME first-paragraph of every package that has one.
Use this as an index to decide which full AIREADME.md to Read next.`

// ============================================================================
// Main crawl
// ============================================================================

export const buildModulesIndex = (
  options: ModulesIndexOptions
): Effect.Effect<
  string,
  PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const pathModule = yield* Path.Path
    const {
      rootDir: rawRootDir,
      excludePatterns = DEFAULT_EXCLUDE,
    } = options

    const rootDir = pathModule.normalize(rawRootDir)

    const discovered = yield* discoverPackages(rootDir, excludePatterns)

    const byPathAsc = Order.mapInput(Order.string, (p: DiscoveredPackage) => p.path)
    const sorted = pipe(discovered, Array.sort(byPathAsc))

    const entries = yield* pipe(
      sorted,
      Array.map(pkg => hydrateEntry(rootDir, pkg)),
      Effect.all
    )

    const sections = pipe(
      entries,
      Array.map(entry => renderEntry(entry, rootDir))
    )

    return [FRAMING_MESSAGE, "", ...sections].join("\n\n")
  })

// ============================================================================
// CLI entrypoint
// ============================================================================

const program = Effect.gen(function* () {
  const rootDir = process.cwd()
  const output = yield* buildModulesIndex({ rootDir })
  yield* Console.log(output)
})

const runnable = pipe(
  program,
  Effect.provide(BunContext.layer),
  Effect.catchAll(error =>
    Console.error(`modules-index error: ${error}`).pipe(
      Effect.map(() => void 0)
    )
  )
)

BunRuntime.runMain(runnable)
