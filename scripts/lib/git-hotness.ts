/**
 * Git hotness helpers — submodule-aware file-level commit counting.
 *
 * @category Scripts/lib
 * @since 1.0.0
 */

import { Command, CommandExecutor } from "@effect/platform"
import { Effect, pipe } from "effect"

// ============================================================================
// Submodule parsing
// ============================================================================

export interface SubmoduleEntry {
  readonly path: string
  readonly isOwned: boolean
}

/**
 * Parse `.gitmodules` content into a list of submodule entries.
 * Owned = path does NOT start with `.`.
 * External (`.references/`, `.repos/`, `.context/`) = path starts with `.` → skipped for crawling.
 */
export const parseGitmodules = (content: string): ReadonlyArray<SubmoduleEntry> => {
  const entries: SubmoduleEntry[] = []
  let currentPath: string | null = null

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    const pathMatch = trimmed.match(/^path\s*=\s*(.+)$/)
    if (pathMatch) {
      currentPath = pathMatch[1].trim()
    }
    if (trimmed.startsWith("[submodule ") && currentPath !== null) {
      currentPath = null
    }
    if (currentPath !== null && trimmed.startsWith("path")) {
      // already captured above
    }
  }

  // Second pass: proper block parsing
  const blocks = content.split(/\[submodule\s+"[^"]+"\]/).slice(1)
  for (const block of blocks) {
    const pathMatch = block.match(/path\s*=\s*(.+)/)
    if (pathMatch) {
      const path = pathMatch[1].trim()
      const isOwned = !path.startsWith(".")
      entries.push({ path, isOwned })
    }
  }

  return entries
}

// ============================================================================
// Parent-repo pointer-bump check
// ============================================================================

/**
 * Returns the number of parent-repo commits that touched the given path
 * within the hot window. Works for both normal dirs and submodule paths
 * (submodule pointer bumps show up as commits even though `--name-only` is empty).
 */
const countParentCommitsTouchingPath = (
  rootDir: string,
  submodulePath: string,
  windowDays: number
): Effect.Effect<number, never, CommandExecutor.CommandExecutor> =>
  pipe(
    Command.make(
      "git",
      "log",
      `--since=${windowDays} days ago`,
      "--oneline",
      "--",
      submodulePath
    ),
    Command.workingDirectory(rootDir),
    Command.string,
    Effect.map(output => output.trim().split("\n").filter(l => l.trim().length > 0).length),
    Effect.orElseSucceed(() => 0)
  )

// ============================================================================
// Submodule git log parsing (same format as parent)
// ============================================================================

export interface CommitEntry {
  readonly sha: string
  readonly author: string
}

const parseSubmoduleLog = (
  output: string,
  submodulePath: string
): ReadonlyMap<string, ReadonlyArray<CommitEntry>> => {
  const fileToEntries = new Map<string, Array<CommitEntry>>()
  let currentEntry: CommitEntry | null = null

  for (const line of output.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "") continue

    if (trimmed.includes("|")) {
      const pipeIdx = trimmed.indexOf("|")
      const sha = trimmed.slice(0, pipeIdx)
      const author = trimmed.slice(pipeIdx + 1)
      currentEntry = { sha, author }
    } else if (currentEntry !== null) {
      // Rewrite path to be root-relative
      const repoRelative = `${submodulePath}/${trimmed}`
      const existing = fileToEntries.get(repoRelative) ?? []
      existing.push(currentEntry)
      fileToEntries.set(repoRelative, existing)
    }
  }

  return fileToEntries
}

// ============================================================================
// Submodule-aware hotness fetch — returns file→CommitEntry[] map
// ============================================================================

/**
 * Fetch git log from the given directory using the `%H|%an` format.
 * Returns a map of (root-relative) file path → commit entries.
 */
const fetchFileMap = (
  repoDir: string,
  windowDays: number,
  pathPrefix: string
): Effect.Effect<ReadonlyMap<string, ReadonlyArray<CommitEntry>>, never, CommandExecutor.CommandExecutor> =>
  pipe(
    Command.make(
      "git",
      "log",
      `--since=${windowDays} days ago`,
      "--name-only",
      "--pretty=format:%H|%an",
      "--all"
    ),
    Command.workingDirectory(repoDir),
    Command.string,
    Effect.map(output => parseSubmoduleLog(output, pathPrefix === "" ? "" : pathPrefix)),
    Effect.orElseSucceed(() => new Map<string, ReadonlyArray<CommitEntry>>())
  )

/**
 * Fetch git log from parent repo only (path prefix is empty — paths are already root-relative).
 */
const fetchParentFileMap = (
  rootDir: string,
  windowDays: number
): Effect.Effect<ReadonlyMap<string, ReadonlyArray<CommitEntry>>, never, CommandExecutor.CommandExecutor> =>
  pipe(
    Command.make(
      "git",
      "log",
      `--since=${windowDays} days ago`,
      "--name-only",
      "--pretty=format:%H|%an",
      "--all"
    ),
    Command.workingDirectory(rootDir),
    Command.string,
    Effect.map(output => {
      const fileToEntries = new Map<string, Array<CommitEntry>>()
      let currentEntry: CommitEntry | null = null

      for (const line of output.split("\n")) {
        const trimmed = line.trim()
        if (trimmed === "") continue

        if (trimmed.includes("|")) {
          const pipeIdx = trimmed.indexOf("|")
          const sha = trimmed.slice(0, pipeIdx)
          const author = trimmed.slice(pipeIdx + 1)
          currentEntry = { sha, author }
        } else if (currentEntry !== null) {
          const existing = fileToEntries.get(trimmed) ?? []
          existing.push(currentEntry)
          fileToEntries.set(trimmed, existing)
        }
      }

      return fileToEntries as ReadonlyMap<string, ReadonlyArray<CommitEntry>>
    }),
    Effect.orElseSucceed(() => new Map<string, ReadonlyArray<CommitEntry>>())
  )

// ============================================================================
// Merge helpers
// ============================================================================

const mergeFileMaps = (
  maps: ReadonlyArray<ReadonlyMap<string, ReadonlyArray<CommitEntry>>>
): ReadonlyMap<string, ReadonlyArray<CommitEntry>> => {
  const result = new Map<string, Array<CommitEntry>>()
  for (const map of maps) {
    for (const [path, entries] of map) {
      const existing = result.get(path) ?? []
      result.set(path, [...existing, ...entries])
    }
  }
  return result
}

// ============================================================================
// Public API: fetchHotnessFileMap
// ============================================================================

/**
 * Fetch the full hotness file map (root-relative file path → commit entries)
 * from the parent repo plus any owned submodules that have had pointer bumps
 * within the hot window.
 *
 * Owned submodule: path does NOT start with `.` (e.g., `packages-shared`).
 * External submodule: path starts with `.` — skipped entirely.
 * Gate: only recurse into submodule if parent shows ≥1 pointer-bump commit
 * within the window.
 */
export const fetchHotnessFileMap = (
  rootDir: string,
  windowDays: number,
  gitmodulesContent: string | null
): Effect.Effect<
  ReadonlyMap<string, ReadonlyArray<CommitEntry>>,
  never,
  CommandExecutor.CommandExecutor
> =>
  Effect.gen(function* () {
    const parentMap = yield* fetchParentFileMap(rootDir, windowDays)

    if (gitmodulesContent === null) {
      return parentMap
    }

    const submodules = parseGitmodules(gitmodulesContent)
    const ownedSubmodules = submodules.filter(s => s.isOwned)

    if (ownedSubmodules.length === 0) {
      return parentMap
    }

    const submoduleMaps = yield* Effect.all(
      ownedSubmodules.map(sub =>
        Effect.gen(function* () {
          const pointerBumps = yield* countParentCommitsTouchingPath(
            rootDir,
            sub.path,
            windowDays
          )

          if (pointerBumps === 0) {
            return new Map<string, ReadonlyArray<CommitEntry>>() as ReadonlyMap<string, ReadonlyArray<CommitEntry>>
          }

          return yield* fetchFileMap(
            `${rootDir}/${sub.path}`,
            windowDays,
            sub.path
          )
        })
      ),
      { concurrency: "unbounded" }
    )

    return mergeFileMaps([parentMap, ...submoduleMaps])
  })

// ============================================================================
// Package-crawler variant: file→count map (simpler, no author tracking)
// ============================================================================

const countFromParentLog = (
  rootDir: string,
  windowDays: number
): Effect.Effect<ReadonlyMap<string, number>, never, CommandExecutor.CommandExecutor> =>
  pipe(
    Command.make("git", "log", `--since=${windowDays} days ago`, "--name-only", "--pretty=format:"),
    Command.workingDirectory(rootDir),
    Command.string,
    Effect.map(output => {
      const counts = new Map<string, number>()
      for (const line of output.split("\n")) {
        const trimmed = line.trim()
        if (trimmed.length > 0) {
          counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1)
        }
      }
      return counts as ReadonlyMap<string, number>
    }),
    Effect.orElseSucceed(() => new Map<string, number>())
  )

const countFromSubmoduleLog = (
  subDir: string,
  windowDays: number,
  submodulePath: string
): Effect.Effect<ReadonlyMap<string, number>, never, CommandExecutor.CommandExecutor> =>
  pipe(
    Command.make("git", "log", `--since=${windowDays} days ago`, "--name-only", "--pretty=format:"),
    Command.workingDirectory(subDir),
    Command.string,
    Effect.map(output => {
      const counts = new Map<string, number>()
      for (const line of output.split("\n")) {
        const trimmed = line.trim()
        if (trimmed.length > 0) {
          const repoRelative = `${submodulePath}/${trimmed}`
          counts.set(repoRelative, (counts.get(repoRelative) ?? 0) + 1)
        }
      }
      return counts as ReadonlyMap<string, number>
    }),
    Effect.orElseSucceed(() => new Map<string, number>())
  )

const mergeCountMaps = (
  maps: ReadonlyArray<ReadonlyMap<string, number>>
): ReadonlyMap<string, number> => {
  const result = new Map<string, number>()
  for (const map of maps) {
    for (const [path, count] of map) {
      result.set(path, (result.get(path) ?? 0) + count)
    }
  }
  return result
}

/**
 * Fetch file→commit-count map for the package crawler.
 * Includes owned submodule files when the parent shows pointer-bump commits
 * within the window.
 */
export const fetchHotnessCountMap = (
  rootDir: string,
  windowDays: number,
  gitmodulesContent: string | null
): Effect.Effect<ReadonlyMap<string, number>, never, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const parentCounts = yield* countFromParentLog(rootDir, windowDays)

    if (gitmodulesContent === null) {
      return parentCounts
    }

    const submodules = parseGitmodules(gitmodulesContent)
    const ownedSubmodules = submodules.filter(s => s.isOwned)

    if (ownedSubmodules.length === 0) {
      return parentCounts
    }

    const submoduleCounts = yield* Effect.all(
      ownedSubmodules.map(sub =>
        Effect.gen(function* () {
          const pointerBumps = yield* countParentCommitsTouchingPath(
            rootDir,
            sub.path,
            windowDays
          )

          if (pointerBumps === 0) {
            return new Map<string, number>() as ReadonlyMap<string, number>
          }

          return yield* countFromSubmoduleLog(
            `${rootDir}/${sub.path}`,
            windowDays,
            sub.path
          )
        })
      ),
      { concurrency: "unbounded" }
    )

    return mergeCountMaps([parentCounts, ...submoduleCounts])
  })
