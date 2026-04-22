#!/usr/bin/env bun
/**
 * Hot Tree
 *
 * Adaptive-depth directory tree with git-hotness annotations.
 * Hot directories (top-quartile commit count) get depth+1; cold (0 commits) get depth 1.
 * Annotates each directory with its 7-day commit count and distinct-author count.
 *
 * @category Scripts
 * @since 1.0.0
 */

import { BunContext, BunRuntime } from "@effect/platform-bun"
import { CommandExecutor, FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array, Console, Effect, Option, pipe } from "effect"
import { fetchHotnessFileMap } from "./lib/git-hotness.js"

// ============================================================================
// Public types
// ============================================================================

export type DirHeat = "hot" | "warm" | "cold"

export interface Annotation {
  readonly commits: number
  readonly authors: number
}

export interface HotTreeOptions {
  readonly rootDir: string
  readonly hotWindowDays?: number
  readonly baseDepth?: number
  readonly excludePatterns?: ReadonlyArray<string>
  readonly hotnessOverride?: ReadonlyMap<string, Annotation>
  readonly hotThresholdQuantile?: number
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_HOT_WINDOW_DAYS = 7
const DEFAULT_BASE_DEPTH = 1
const DEFAULT_HOT_THRESHOLD_QUANTILE = 0.75
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

// ============================================================================
// Filesystem scan
// ============================================================================

interface DirNode {
  readonly name: string
  readonly relPath: string
  readonly children: ReadonlyArray<DirNode>
}

const scanDir = (
  rootDir: string,
  dir: string,
  excludeSet: ReadonlySet<string>,
  maxDepth: number,
  currentDepth: number
): Effect.Effect<ReadonlyArray<DirNode>, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    if (currentDepth > maxDepth) return []

    const fs = yield* FileSystem.FileSystem
    const pathModule = yield* Path.Path

    const entries = yield* Effect.orElseSucceed(fs.readDirectory(dir), () => Array.empty<string>())

    const nodes = yield* pipe(
      entries,
      Array.filter(entry => !excludeSet.has(entry)),
      Array.map(entry => {
        const fullPath = pathModule.join(dir, entry)
        const relPath = fullPath.slice(rootDir.length + 1)
        return fs.stat(fullPath).pipe(
          Effect.flatMap(stat => {
            if (stat.type !== "Directory") return Effect.succeed(Option.none<DirNode>())
            return Effect.suspend(() =>
              scanDir(rootDir, fullPath, excludeSet, maxDepth, currentDepth + 1)
            ).pipe(
              Effect.map(children => Option.some<DirNode>({ name: entry, relPath, children }))
            )
          }),
          Effect.orElseSucceed(() => Option.none<DirNode>())
        )
      }),
      Effect.all,
      Effect.map(Array.getSomes)
    )

    return nodes
  })

const scanTopLevel = (
  rootDir: string,
  excludeSet: ReadonlySet<string>
): Effect.Effect<ReadonlyArray<DirNode>, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathModule = yield* Path.Path

    const entries = yield* Effect.orElseSucceed(fs.readDirectory(rootDir), () => Array.empty<string>())

    const nodes = yield* pipe(
      entries,
      Array.filter(entry => !excludeSet.has(entry)),
      Array.map(entry => {
        const fullPath = pathModule.join(rootDir, entry)
        const relPath = entry
        return fs.stat(fullPath).pipe(
          Effect.flatMap(stat => {
            if (stat.type !== "Directory") return Effect.succeed(Option.none<DirNode>())
            return Effect.succeed(Option.some<DirNode>({ name: entry, relPath, children: [] }))
          }),
          Effect.orElseSucceed(() => Option.none<DirNode>())
        )
      }),
      Effect.all,
      Effect.map(Array.getSomes)
    )

    return nodes
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

const aggregateToDirs = (
  fileMap: ReadonlyMap<string, ReadonlyArray<{ readonly sha: string; readonly author: string }>>,
  dirRelPath: string
): Annotation => {
  const shas = new Set<string>()
  const authors = new Set<string>()

  for (const [filePath, entries] of fileMap) {
    if (filePath.startsWith(dirRelPath + "/") || filePath === dirRelPath) {
      for (const entry of entries) {
        shas.add(entry.sha)
        authors.add(entry.author)
      }
    }
  }

  return { commits: shas.size, authors: authors.size }
}

const fetchGitAnnotations = (
  rootDir: string,
  windowDays: number,
  topLevelDirs: ReadonlyArray<DirNode>
): Effect.Effect<ReadonlyMap<string, Annotation>, never, FileSystem.FileSystem | CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const gitmodulesContent = yield* readGitmodules(rootDir)
    const fileMap = yield* fetchHotnessFileMap(rootDir, windowDays, gitmodulesContent)
    const result = new Map<string, Annotation>()
    for (const node of topLevelDirs) {
      result.set(node.relPath, aggregateToDirs(fileMap, node.relPath))
    }
    return result as ReadonlyMap<string, Annotation>
  })

// ============================================================================
// Hotness classification
// ============================================================================

const computeQuantile = (values: ReadonlyArray<number>, quantile: number): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil(quantile * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

const classifyDirs = (
  topLevelDirs: ReadonlyArray<DirNode>,
  annotations: ReadonlyMap<string, Annotation>,
  quantile: number
): ReadonlyMap<string, DirHeat> => {
  const nonZeroCommits = pipe(
    topLevelDirs,
    Array.filterMap(node => {
      const ann = annotations.get(node.relPath)
      return ann !== undefined && ann.commits > 0 ? Option.some(ann.commits) : Option.none()
    })
  )

  const threshold = computeQuantile(nonZeroCommits, quantile)

  const result = new Map<string, DirHeat>()
  for (const node of topLevelDirs) {
    const ann = annotations.get(node.relPath)
    const commits = ann?.commits ?? 0
    if (commits === 0) {
      result.set(node.relPath, "cold")
    } else if (commits >= threshold) {
      result.set(node.relPath, "hot")
    } else {
      result.set(node.relPath, "warm")
    }
  }
  return result
}

// ============================================================================
// Subtree scan at effective depth
// ============================================================================

const scanSubtree = (
  rootDir: string,
  topNode: DirNode,
  effectiveDepth: number,
  excludeSet: ReadonlySet<string>
): Effect.Effect<DirNode, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const pathModule = yield* Path.Path

    if (effectiveDepth <= 1) {
      return { ...topNode, children: [] }
    }

    const children = yield* scanDir(
      rootDir,
      pathModule.join(rootDir, topNode.relPath),
      excludeSet,
      effectiveDepth - 1,
      1
    )

    return { ...topNode, children }
  })

// ============================================================================
// ASCII tree rendering
// ============================================================================

const formatAnnotation = (ann: Annotation | undefined, heat: DirHeat): string => {
  if (ann === undefined || ann.commits === 0) return ""
  if (heat === "hot") {
    return ann.authors > 1 ? ` (${ann.commits}c, ${ann.authors}a)` : ` (${ann.commits}c)`
  }
  return ` (${ann.commits}c)`
}

const renderSubtree = (
  nodes: ReadonlyArray<DirNode>,
  prefix: string,
  annotations: ReadonlyMap<string, Annotation>,
  heat: DirHeat,
  lines: Array<string>
): void => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const isLast = i === nodes.length - 1
    const connector = isLast ? "└── " : "├── "
    const ann = annotations.get(node.relPath)
    const annotation = formatAnnotation(ann, heat)
    lines.push(`${prefix}${connector}${node.name}/${annotation}`)

    if (node.children.length > 0) {
      const childPrefix = prefix + (isLast ? "    " : "│   ")
      renderSubtree(node.children, childPrefix, annotations, heat, lines)
    }
  }
}

const LEGEND = "# Legend: (Nc, Na) = N commits by A authors in last 7d. Hot dirs expand deeper; cold dirs show name only."

const renderTree = (
  rootName: string,
  topLevelNodes: ReadonlyArray<DirNode>,
  annotations: ReadonlyMap<string, Annotation>,
  heatMap: ReadonlyMap<string, DirHeat>
): string => {
  const lines: Array<string> = [LEGEND, `${rootName}/`]

  for (let i = 0; i < topLevelNodes.length; i++) {
    const node = topLevelNodes[i]
    const isLast = i === topLevelNodes.length - 1
    const connector = isLast ? "└── " : "├── "
    const heat = heatMap.get(node.relPath) ?? "warm"
    const ann = annotations.get(node.relPath)
    const annotation = formatAnnotation(ann, heat)

    lines.push(`${connector}${node.name}/${annotation}`)

    if (node.children.length > 0) {
      const childPrefix = isLast ? "    " : "│   "
      renderSubtree(node.children, childPrefix, annotations, heat, lines)
    }
  }

  return lines.join("\n")
}

// ============================================================================
// Main function
// ============================================================================

export const buildHotTree = (
  options: HotTreeOptions
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path | CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const pathModule = yield* Path.Path
    const {
      rootDir: rawRootDir,
      hotWindowDays = DEFAULT_HOT_WINDOW_DAYS,
      baseDepth = DEFAULT_BASE_DEPTH,
      excludePatterns = DEFAULT_EXCLUDE,
      hotnessOverride,
      hotThresholdQuantile = DEFAULT_HOT_THRESHOLD_QUANTILE,
    } = options

    const rootDir = pathModule.normalize(rawRootDir)
    const excludeSet = new Set(excludePatterns)
    const rootName = pathModule.basename(rootDir)

    const topLevelNodes = yield* scanTopLevel(rootDir, excludeSet)

    const annotations: ReadonlyMap<string, Annotation> =
      hotnessOverride !== undefined
        ? hotnessOverride
        : yield* fetchGitAnnotations(rootDir, hotWindowDays, topLevelNodes)

    const heatMap = classifyDirs(topLevelNodes, annotations, hotThresholdQuantile)

    const hydratedNodes = yield* pipe(
      topLevelNodes,
      Array.map(node => {
        const heat = heatMap.get(node.relPath) ?? "warm"
        const effectiveDepth = heat === "cold" ? 1 : heat === "hot" ? baseDepth + 1 : baseDepth
        return scanSubtree(rootDir, node, effectiveDepth, excludeSet)
      }),
      Effect.all
    )

    return renderTree(rootName, hydratedNodes, annotations, heatMap)
  })

// ============================================================================
// CLI entrypoint
// ============================================================================

const program = Effect.gen(function* () {
  const rootDir = process.cwd()
  const result = yield* buildHotTree({ rootDir })
  yield* Console.log(result)
})

const runnable = pipe(
  program,
  Effect.provide(BunContext.layer),
  Effect.catchAll(error =>
    Console.error(`hot-tree error: ${error}`).pipe(Effect.map(() => void 0))
  )
)

BunRuntime.runMain(runnable)
