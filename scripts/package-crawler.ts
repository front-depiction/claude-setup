#!/usr/bin/env bun
/**
 * Package Crawler
 *
 * Walks the repo for AIREADME.md / ONTOLOGY.md / INVARIANTS.md, classifies
 * packages as hot (recently-committed) or cold, and emits a single XML block.
 *
 * @category Scripts
 * @since 1.0.0
 */

import { BunContext, BunRuntime } from "@effect/platform-bun"
import { CommandExecutor, FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array, Console, Effect, Option, Order, pipe } from "effect"
import * as Xml from "../../tools/layer-wire/xml/Xml.js"
import { fetchHotnessCountMap } from "./lib/git-hotness.js"

// ============================================================================
// Public types
// ============================================================================

export type AiFile = "AIREADME" | "ONTOLOGY" | "INVARIANTS"

export interface CrawlOptions {
  readonly rootDir: string
  readonly hotWindowDays?: number
  readonly maxHotPackages?: number
  readonly excludePatterns?: ReadonlyArray<string>
  readonly hotnessOverride?: ReadonlyMap<string, number>
}

export interface PackagesResult {
  readonly recent: ReadonlyArray<HotPackage>
  readonly index: ReadonlyArray<ColdPackage>
}

export interface HotPackage {
  readonly path: string
  readonly airreadme?: string
  readonly ontology?: string
  readonly invariants?: string
  readonly commitCount: number
}

export interface ColdPackage {
  readonly path: string
  readonly files: ReadonlyArray<AiFile>
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_HOT_WINDOW_DAYS = 3
const DEFAULT_MAX_HOT_PACKAGES = 10
const DEFAULT_EXCLUDE = ["node_modules", ".git", "dist", ".turbo", "build", ".next", ".cache", "coverage", "__tests__", "__archive__"]
const AI_FILES = ["AIREADME.md", "ONTOLOGY.md", "INVARIANTS.md"] as const

// ============================================================================
// Discovery
// ============================================================================

const discoverPackages = (
  rootDir: string,
  excludePatterns: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<{ path: string; files: ReadonlyArray<AiFile> }>, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathModule = yield* Path.Path

    const excludeSet = new Set(excludePatterns)

    const searchDir = (
      dir: string
    ): Effect.Effect<
      Array<{ path: string; files: ReadonlyArray<AiFile> }>,
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

        const thisPackage: Array<{ path: string; files: ReadonlyArray<AiFile> }> =
          presentFiles.length > 0
            ? [{ path: relPath, files: presentFiles }]
            : []

        const childResults = yield* pipe(
          entries,
          Array.map(entry => {
            if (excludeSet.has(entry)) return Effect.succeed(Array.empty<{ path: string; files: ReadonlyArray<AiFile> }>())
            const fullPath = pathModule.join(dir, entry)
            return fs.stat(fullPath).pipe(
              Effect.flatMap(stat =>
                stat.type === "Directory"
                  ? Effect.suspend(() => searchDir(fullPath))
                  : Effect.succeed(Array.empty<{ path: string; files: ReadonlyArray<AiFile> }>())
              ),
              Effect.orElseSucceed(() => Array.empty<{ path: string; files: ReadonlyArray<AiFile> }>())
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
// Git hotness
// ============================================================================

const readGitmodules = (
  rootDir: string
): Effect.Effect<string | null, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = `${rootDir}/.gitmodules`
    const exists = yield* Effect.orElseSucceed(fs.exists(path), () => false)
    if (!exists) return null
    return yield* Effect.orElseSucceed(fs.readFileString(path), () => null)
  })

const computePackageCommitCount = (
  packagePath: string,
  fileCounts: ReadonlyMap<string, number>
): number => {
  let total = 0
  for (const [filePath, count] of fileCounts) {
    if (filePath.startsWith(packagePath + "/") || filePath === packagePath) {
      total += count
    }
  }
  return total
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

const hydrateHot = (
  rootDir: string,
  packagePath: string,
  files: ReadonlyArray<AiFile>,
  commitCount: number
): Effect.Effect<HotPackage, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const base = `${rootDir}/${packagePath}`

    const airreadme = files.includes("AIREADME")
      ? yield* readFileOptional(`${base}/AIREADME.md`)
      : Option.none<string>()

    const ontology = files.includes("ONTOLOGY")
      ? yield* readFileOptional(`${base}/ONTOLOGY.md`)
      : Option.none<string>()

    const invariants = files.includes("INVARIANTS")
      ? yield* readFileOptional(`${base}/INVARIANTS.md`)
      : Option.none<string>()

    const hot: HotPackage = {
      path: packagePath,
      commitCount,
      ...(Option.isSome(airreadme) ? { airreadme: airreadme.value } : {}),
      ...(Option.isSome(ontology) ? { ontology: ontology.value } : {}),
      ...(Option.isSome(invariants) ? { invariants: invariants.value } : {}),
    }

    return hot
  })

// ============================================================================
// Main crawl
// ============================================================================

export const crawlPackages = (
  options: CrawlOptions
): Effect.Effect<
  PackagesResult,
  PlatformError,
  FileSystem.FileSystem | Path.Path | CommandExecutor.CommandExecutor
> =>
  Effect.gen(function* () {
    const pathModule = yield* Path.Path
    const {
      rootDir: rawRootDir,
      hotWindowDays = DEFAULT_HOT_WINDOW_DAYS,
      maxHotPackages = DEFAULT_MAX_HOT_PACKAGES,
      excludePatterns = DEFAULT_EXCLUDE,
      hotnessOverride,
    } = options

    const rootDir = pathModule.normalize(rawRootDir)

    const discovered = yield* discoverPackages(rootDir, excludePatterns)

    const fileCounts: ReadonlyMap<string, number> =
      hotnessOverride !== undefined
        ? hotnessOverride
        : yield* Effect.gen(function* () {
            const gitmodulesContent = yield* readGitmodules(rootDir)
            return yield* fetchHotnessCountMap(rootDir, hotWindowDays, gitmodulesContent)
          })

    const withCounts = pipe(
      discovered,
      Array.map(pkg => ({
        ...pkg,
        commitCount: computePackageCommitCount(pkg.path, fileCounts),
      }))
    )

    const byCommitDesc = Order.mapInput(
      Order.reverse(Order.number),
      (p: { commitCount: number }) => p.commitCount
    )

    const hotCandidates = pipe(
      withCounts,
      Array.filter(p => p.commitCount >= 3),
      Array.sort(byCommitDesc),
      Array.take(maxHotPackages)
    )

    const hotPaths = new Set(hotCandidates.map(p => p.path))

    const coldPackages: ColdPackage[] = pipe(
      withCounts,
      Array.filter(p => !hotPaths.has(p.path)),
      Array.map(p => ({ path: p.path, files: p.files }))
    )

    const hotPackages = yield* pipe(
      hotCandidates,
      Array.map(p => hydrateHot(rootDir, p.path, p.files, p.commitCount)),
      Effect.all
    )

    return { recent: hotPackages, index: coldPackages }
  })

// ============================================================================
// XML rendering
// ============================================================================

const renderHotPackage = (pkg: HotPackage): Xml.XmlNode => {
  const children: Array<Xml.XmlNode> = []

  if (pkg.airreadme !== undefined) {
    children.push(Xml.raw(pkg.airreadme).pipe(Xml.wrap("airreadme")))
  }
  if (pkg.ontology !== undefined) {
    children.push(Xml.raw(pkg.ontology).pipe(Xml.wrap("ontology")))
  }
  if (pkg.invariants !== undefined) {
    children.push(Xml.raw(pkg.invariants).pipe(Xml.wrap("invariants")))
  }

  return Xml.nest(children, pkg.path)
}

const renderIndexLine = (pkg: ColdPackage): string => {
  const fileList = pkg.files.join(" + ")
  return `${pkg.path} → ${fileList}`
}

export const renderXml = (result: PackagesResult): string => {
  const recentNode = Xml.nest(
    result.recent.map(renderHotPackage),
    "recent"
  )

  const indexContent = result.index.map(renderIndexLine).join("\n")
  const indexNode = Xml.raw(indexContent).pipe(Xml.wrap("index"))

  const root = Xml.nest([recentNode, indexNode], "packages")

  return Xml.toString(root, { indent: false })
}

// ============================================================================
// CLI entrypoint
// ============================================================================

const program = Effect.gen(function* () {
  const rootDir = process.cwd()

  const result = yield* crawlPackages({ rootDir })
  const xml = renderXml(result)

  yield* Console.log(xml)
})

const runnable = pipe(
  program,
  Effect.provide(BunContext.layer),
  Effect.catchAll(error =>
    Console.error(`Package crawler error: ${error}`).pipe(
      Effect.map(() => void 0)
    )
  )
)

BunRuntime.runMain(runnable)
