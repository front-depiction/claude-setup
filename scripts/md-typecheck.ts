#!/usr/bin/env bun
import { Command, CommandExecutor, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { PlatformError } from "@effect/platform/Error"
import { Array, Console, Data, Effect, pipe } from "effect"

// ============================================================================
// Data Types
// ============================================================================

class CodeBlock extends Data.TaggedClass("CodeBlock")<{
  sourceFile: string
  sourceLine: number
  language: "ts" | "tsx"
  content: string
  index: number
  nocheck: boolean
}> { }

interface CodeBlockLocation {
  sourceFile: string
  sourceLine: number
  tempFile: string
  preambleLines: number
}

interface TypeError {
  sourceFile: string
  sourceLine: number
  sourceCol: number
  message: string
}

// ============================================================================
// Constants
// ============================================================================

// Global declarations file content - makes all Effect types available globally
// No top-level imports = ambient/global declarations
const GLOBALS_DTS = `// Auto-generated global type declarations for md-typecheck
// This file has no imports, making all declarations global

// ============================================================================
// Effect Core
// ============================================================================
declare const Effect: typeof import('effect').Effect
declare const Console: typeof import('effect').Console
declare const Context: typeof import('effect').Context
declare const Layer: typeof import('effect').Layer
declare const Data: typeof import('effect').Data
declare const Schema: typeof import('effect').Schema
declare const pipe: typeof import('effect').pipe
declare const Option: typeof import('effect').Option
declare const Either: typeof import('effect').Either
declare const Exit: typeof import('effect').Exit
declare const Cause: typeof import('effect').Cause
declare const Match: typeof import('effect').Match
declare const Stream: typeof import('effect').Stream
declare const Chunk: typeof import('effect').Chunk
declare const Queue: typeof import('effect').Queue
declare const Deferred: typeof import('effect').Deferred
declare const Fiber: typeof import('effect').Fiber
declare const STM: typeof import('effect').STM
declare const TRef: typeof import('effect').TRef
declare const Duration: typeof import('effect').Duration
declare const Schedule: typeof import('effect').Schedule
declare const Scope: typeof import('effect').Scope
declare const Config: typeof import('effect').Config
declare const Ref: typeof import('effect').Ref
declare const HashMap: typeof import('effect').HashMap
declare const HashSet: typeof import('effect').HashSet
declare const List: typeof import('effect').List
declare const Predicate: typeof import('effect').Predicate
declare const Logger: typeof import('effect').Logger
declare const LogLevel: typeof import('effect').LogLevel
declare const Metric: typeof import('effect').Metric
declare const MetricLabel: typeof import('effect').MetricLabel
declare const RuntimeFlags: typeof import('effect').RuntimeFlags
declare const FiberRef: typeof import('effect').FiberRef
declare const FiberRefs: typeof import('effect').FiberRefs
declare const ReadonlyRecord: typeof import('effect').ReadonlyRecord
declare const Struct: typeof import('effect').Struct
declare const Tuple: typeof import('effect').Tuple
declare const Types: typeof import('effect').Types
declare const Unify: typeof import('effect').Unify
declare const Fn: typeof import('effect').Function

// ============================================================================
// Effect Submodules (namespace imports)
// ============================================================================
declare const DateTime: typeof import('effect/DateTime')
declare const Array: typeof import('effect/Array')
declare const Order: typeof import('effect/Order')
declare const Equal: typeof import('effect/Equal')
declare const Equivalence: typeof import('effect/Equivalence')
declare const Brand: typeof import('effect/Brand')
declare const Random: typeof import('effect/Random')
declare const Clock: typeof import('effect/Clock')
declare const TestClock: typeof import('effect/TestClock')
declare const Number: typeof import('effect/Number')
declare const String: typeof import('effect/String')
declare const Boolean: typeof import('effect/Boolean')
declare const Record: typeof import('effect/Record')

// Effect/Function utilities
declare const dual: typeof import('effect/Function').dual
declare const identity: typeof import('effect/Function').identity
declare const flow: typeof import('effect/Function').flow

// ============================================================================
// @effect/platform
// ============================================================================
declare const FileSystem: typeof import('@effect/platform').FileSystem
declare const Path: typeof import('@effect/platform').Path
declare const Command: typeof import('@effect/platform').Command
declare const CommandExecutor: typeof import('@effect/platform').CommandExecutor
declare const Terminal: typeof import('@effect/platform').Terminal
declare const PlatformError: typeof import('@effect/platform/Error').PlatformError
declare const SystemError: typeof import('@effect/platform/Error').SystemError

// ============================================================================
// @effect/platform-bun
// ============================================================================
declare const BunContext: typeof import('@effect/platform-bun').BunContext
declare const BunRuntime: typeof import('@effect/platform-bun').BunRuntime

// ============================================================================
// @effect/vitest
// ============================================================================
declare const it: typeof import('@effect/vitest').it
declare const expect: typeof import('@effect/vitest').expect
declare const describe: typeof import('@effect/vitest').describe
declare const layer: typeof import('@effect/vitest').layer

// ============================================================================
// @effect/cli
// ============================================================================
declare const Args: typeof import('@effect/cli').Args
declare const Options: typeof import('@effect/cli').Options
declare const CliCommand: typeof import('@effect/cli').Command
declare const Prompt: typeof import('@effect/cli').Prompt

// ============================================================================
// React
// ============================================================================
declare const React: typeof import('react')
declare const useState: typeof import('react').useState
declare const useEffect: typeof import('react').useEffect
declare const useCallback: typeof import('react').useCallback
declare const useMemo: typeof import('react').useMemo
declare const useRef: typeof import('react').useRef
`

const PACKAGE_JSON = {
  name: "md-typecheck-temp",
  type: "module",
  dependencies: {
    "effect": "^3.12.0",
    "@effect/platform": "^0.92.0",
    "@effect/platform-bun": "^0.81.0",
    "@effect/vitest": "^0.16.0",
    "@effect/schema": "^0.75.0",
    "@effect/cli": "^0.50.0",
    "typescript": "^5.7.0",
    "@types/bun": "^1.2.0",
    "@types/react": "^19.0.0",
    "react": "^19.0.0",
  },
}

const TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    lib: ["ES2022"],
    moduleResolution: "bundler",
    allowImportingTsExtensions: true,
    jsx: "react-jsx",
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    isolatedModules: true,
    resolveJsonModule: true,
  },
}

// ============================================================================
// File System Operations
// ============================================================================

// Directories to skip when crawling for markdown files
const SKIP_DIRECTORIES = new Set(["node_modules", "md-typecheck-output", ".git", "dist", "build"])

const crawlMarkdownFiles = (
  dir: string
): Effect.Effect<ReadonlyArray<string>, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const crawl = (currentDir: string): Effect.Effect<ReadonlyArray<string>, PlatformError> => fs.readDirectory(currentDir).pipe(
      Effect.flatMap(entries => Effect.forEach(entries, (entry) =>
        Effect.gen(function* () {
          // Skip excluded directories
          if (SKIP_DIRECTORIES.has(entry)) {
            return []
          }
          const fullPath = path.join(currentDir, entry)
          const stat = yield* fs.stat(fullPath).pipe(Effect.orDie)
          if (stat.type === "Directory") {
            return yield* Effect.suspend(() => crawl(fullPath))
          } else if (entry.endsWith(".md")) {
            return [fullPath]
          }
          return []
        }),
        { concurrency: 100 }
      )),
      Effect.map(Array.flatten)
    )

    return yield* crawl(dir)
  })

// ============================================================================
// Code Block Extraction
// ============================================================================

// Strip import statements from code to avoid duplicates with preamble
const stripImports = (code: string): string => {
  const lines = code.split("\n")
  const nonImportLines: string[] = []
  let inMultilineImport = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Handle multiline imports
    if (inMultilineImport) {
      // Check if this line ends the import (has 'from' followed by a string)
      if (trimmed.match(/from\s+["'][^"']+["']\s*;?\s*$/)) {
        inMultilineImport = false
        continue
      }
      // Also check for closing brace followed by from on same line
      if (trimmed.match(/}\s*from\s+["'][^"']+["']\s*;?\s*$/)) {
        inMultilineImport = false
        continue
      }
      continue
    }

    // Skip single-line import statements (including import type)
    if (trimmed.match(/^import\s+(type\s+)?(\{[^}]*\}|[\w*]+(\s*,\s*\{[^}]*\})?)\s+from\s+["']/)) {
      continue
    }

    // Skip side-effect imports: import "module" or import 'module'
    if (trimmed.match(/^import\s+["'][^"']+["']\s*;?\s*$/)) {
      continue
    }

    // Check if this is the start of a multiline import
    if (trimmed.match(/^import\s+(type\s+)?(\{|\* as|\w+)/)) {
      if (trimmed.includes("{") && !trimmed.includes("}")) {
        inMultilineImport = true
        continue
      }
      // Single-line import that wasn't caught above
      if (trimmed.includes("from ")) {
        continue
      }
    }

    // Skip re-exports: export * from, export { } from
    if (trimmed.match(/^export\s+(\*|\{[^}]*\})\s+from\s+["']/)) {
      continue
    }

    nonImportLines.push(line)
  }

  // Remove leading empty lines
  while (nonImportLines.length > 0 && nonImportLines[0].trim() === "") {
    nonImportLines.shift()
  }

  return nonImportLines.join("\n")
}

const extractCodeBlocks = (
  file: string,
  content: string
): ReadonlyArray<CodeBlock> => {
  // Match code fences with optional modifiers: ```typescript nocheck or ```ts or ```tsx
  const regex = /^```(typescript|ts|tsx)(?:\s+(nocheck))?\n([\s\S]*?)^```/gm
  const blocks: Array<CodeBlock> = []
  let match: RegExpExecArray | null
  let index = 0

  while ((match = regex.exec(content)) !== null) {
    const langTag = match[1]
    const modifier = match[2]
    const code = match[3]
    // Use the markdown language tag directly: ```tsx → .tsx, ```typescript/```ts → .ts
    const language = langTag === "tsx" ? "tsx" as const : "ts" as const
    const nocheck = modifier === "nocheck"
    const sourceLine = content.substring(0, match.index).split("\n").length

    blocks.push(
      new CodeBlock({
        sourceFile: file,
        sourceLine,
        language,
        content: code,
        index: index++,
        nocheck,
      })
    )
  }

  return blocks
}

const extractAllCodeBlocks = (
  files: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<CodeBlock>, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const allBlocks = yield* Effect.forEach(
      files,
      (file) =>
        Effect.gen(function* () {
          const content = yield* fs.readFileString(file).pipe(Effect.orDie)
          return extractCodeBlocks(file, content)
        }),
      { concurrency: "unbounded" }
    )

    return Array.flatten(allBlocks)
  })

// ============================================================================
// Temp File Generation
// ============================================================================

const generateTempFileName = (block: CodeBlock, path: Path.Path): string => {
  const basename = path.basename(block.sourceFile, ".md")
  const parts = block.sourceFile.split(path.sep)
  const relevantParts = parts.slice(-3, -1).join("_")
  const indexStr = String(block.index).padStart(4, "0")
  const ext = block.language === "tsx" ? ".tsx" : ".ts"
  return `block_${indexStr}_${relevantParts}_${basename}${ext}`
}

const writeCodeBlocksToTemp = (
  tempDir: string,
  blocks: ReadonlyArray<CodeBlock>
): Effect.Effect<ReadonlyArray<CodeBlockLocation>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Write package.json
    yield* fs.writeFileString(
      path.join(tempDir, "package.json"),
      JSON.stringify(PACKAGE_JSON, null, 2)
    ).pipe(Effect.orDie)

    // Write tsconfig.json
    yield* fs.writeFileString(
      path.join(tempDir, "tsconfig.json"),
      JSON.stringify(TSCONFIG, null, 2)
    ).pipe(Effect.orDie)

    // Write _globals.d.ts - makes all Effect types globally available
    yield* fs.writeFileString(
      path.join(tempDir, "_globals.d.ts"),
      GLOBALS_DTS
    ).pipe(Effect.orDie)

    // Write code blocks WITHOUT preamble (types come from _globals.d.ts)
    const locations = yield* Effect.forEach(
      blocks,
      (block) =>
        Effect.gen(function* () {
          const tempFileName = generateTempFileName(block, path)
          const tempFilePath = path.join(tempDir, tempFileName)
          const strippedContent = stripImports(block.content)
          yield* fs.writeFileString(tempFilePath, strippedContent).pipe(Effect.orDie)

          return {
            sourceFile: block.sourceFile,
            sourceLine: block.sourceLine,
            tempFile: tempFileName,
            preambleLines: 0, // No preamble - types come from _globals.d.ts
          } satisfies CodeBlockLocation
        }),
      { concurrency: "unbounded" }
    )

    return locations
  })

// ============================================================================
// TypeScript Type Checking
// ============================================================================

const installDependencies = (
  tempDir: string
): Effect.Effect<void, never, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const command = pipe(
      Command.make("bun", "install", "--silent"),
      Command.workingDirectory(tempDir),
      Command.stderr("inherit")
    )
    yield* Command.exitCode(command).pipe(Effect.orDie)
  })

const runTypeCheck = (
  tempDir: string
): Effect.Effect<string, never, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const command = pipe(
      Command.make("bun", "run", "tsc", "--noEmit", "--pretty", "false"),
      Command.workingDirectory(tempDir)
    )

    // tsc returns non-zero exit code on type errors, but we still need the output
    const result = yield* pipe(
      Command.string(command),
      Effect.catchAll(() =>
        pipe(
          Command.make("bun", "run", "tsc", "--noEmit", "--pretty", "false"),
          Command.workingDirectory(tempDir),
          Command.lines,
          Effect.map(Array.join("\n")),
          Effect.catchAll(() => Effect.succeed(""))
        )
      )
    )

    return result
  })

// ============================================================================
// Error Parsing and Mapping
// ============================================================================

const parseTypeScriptError = (
  line: string,
  locations: ReadonlyArray<CodeBlockLocation>
): TypeError | null => {
  // Parse: file.ts(line,col): error TSxxxx: message
  const match = /^(.+?)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)$/.exec(line)
  if (!match) return null

  const [, tempFile, lineStr, colStr, message] = match
  const tempFileName = tempFile.split("/").pop() || tempFile
  const errorLine = parseInt(lineStr, 10)
  const errorCol = parseInt(colStr, 10)

  // Find the corresponding source location
  const location = locations.find((loc) => loc.tempFile === tempFileName)
  if (!location) return null

  // Map back to original line
  const originalLine = errorLine - location.preambleLines + location.sourceLine - 1

  return {
    sourceFile: location.sourceFile,
    sourceLine: originalLine,
    sourceCol: errorCol,
    message,
  }
}

const parseTypeScriptErrors = (
  output: string,
  locations: ReadonlyArray<CodeBlockLocation>
): ReadonlyArray<TypeError> => {
  const lines = output.split("\n")
  const errors: Array<TypeError> = []

  for (const line of lines) {
    const error = parseTypeScriptError(line, locations)
    if (error) {
      errors.push(error)
    }
  }

  return errors
}

// Extract missing symbol names from "Cannot find name 'X'" errors
const extractMissingSymbols = (output: string): ReadonlyArray<string> => {
  const symbolSet = new Set<string>()
  const regex = /Cannot find name '([^']+)'/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(output)) !== null) {
    const symbol = match[1]
    // Allow alphanumeric symbols and $ suffix (Effect TaggedEnum companions)
    // Skip symbols that start with underscore
    if (!symbol.startsWith("_") && /^[A-Za-z][A-Za-z0-9$]*$/.test(symbol)) {
      symbolSet.add(symbol)
    }
  }

  return [...symbolSet].sort()
}

/**
 * Symbol usage patterns detected from code analysis
 */
type SymbolUsage = "effect" | "effectFn" | "fn" | "type" | "value" | "taggedEnum"

/**
 * Analyze code blocks to understand how symbols are used
 */
const analyzeSymbolUsage = (
  codeBlocks: ReadonlyArray<CodeBlock>,
  symbols: ReadonlyArray<string>
): Map<string, SymbolUsage> => {
  const usage = new Map<string, SymbolUsage>()
  const allCode = codeBlocks.map(b => b.content).join("\n")

  for (const symbol of symbols) {
    // Check for TaggedEnum companion pattern (ends with $)
    if (symbol.endsWith("$")) {
      usage.set(symbol, "taggedEnum")
      continue
    }

    // Check for yield* symbol(...) - function returning Effect
    const yieldFnPattern = new RegExp(`yield\\*\\s+${symbol}\\s*\\(`, "g")
    if (yieldFnPattern.test(allCode)) {
      usage.set(symbol, "effectFn")
      continue
    }

    // Check for yield* symbol - direct Effect value
    const yieldValuePattern = new RegExp(`yield\\*\\s+${symbol}(?![\\w$(])`, "g")
    if (yieldValuePattern.test(allCode)) {
      usage.set(symbol, "effect")
      continue
    }

    // Check for symbol(...) - regular function call
    const fnPattern = new RegExp(`${symbol}\\s*\\(`, "g")
    if (fnPattern.test(allCode)) {
      usage.set(symbol, "fn")
      continue
    }

    // PascalCase = likely a type
    if (/^[A-Z]/.test(symbol)) {
      usage.set(symbol, "type")
      continue
    }

    // Default to value
    usage.set(symbol, "value")
  }

  return usage
}

/**
 * Generate stub declarations based on analyzed symbol usage
 * Returns declarations to append to _globals.d.ts (no imports needed - already global)
 */
const generateStubs = (
  symbols: ReadonlyArray<string>,
  codeBlocks: ReadonlyArray<CodeBlock>
): string => {
  if (symbols.length === 0) return ""

  const usage = analyzeSymbolUsage(codeBlocks, symbols)

  const lines = [
    "",
    "// ============================================================================",
    "// Auto-generated stubs for example placeholders",
    "// ============================================================================",
  ]

  for (const symbol of symbols) {
    const kind = usage.get(symbol) || "value"

    switch (kind) {
      case "taggedEnum":
        // TaggedEnum companion with $match, $is helpers
        lines.push(`declare const ${symbol}: { $match: <R>(cases: Record<string, (value: any) => R>) => (value: any) => R; $is: (tag: string) => (value: any) => boolean; [key: string]: any }`)
        break

      case "effectFn":
        // Function returning Effect - use Effect.Effect type directly (available globally)
        lines.push(`declare function ${symbol}(...args: any[]): Effect.Effect<any, never, never>`)
        break

      case "effect":
        // Direct Effect value
        lines.push(`declare const ${symbol}: Effect.Effect<any, never, never>`)
        break

      case "fn":
        // Regular function
        lines.push(`declare function ${symbol}(...args: any[]): any`)
        break

      case "type":
        // Type/class - declare as both const and type
        lines.push(`declare const ${symbol}: any`)
        lines.push(`declare type ${symbol} = any`)
        break

      case "value":
      default:
        lines.push(`declare const ${symbol}: any`)
        break
    }
  }

  return lines.join("\n") + "\n"
}

// ============================================================================
// Main Program
// ============================================================================

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  // Step 1: Find all markdown files
  yield* Console.log("Scanning .claude/ for markdown files...")
  const claudeDir = path.join(process.cwd(), ".claude")
  const markdownFiles = yield* crawlMarkdownFiles(claudeDir)
  yield* Console.log(`Found ${markdownFiles.length} markdown files`)

  if (markdownFiles.length === 0) {
    yield* Console.log("No markdown files found")
    return 0
  }

  // Step 2: Extract all code blocks
  const allCodeBlocks = yield* extractAllCodeBlocks(markdownFiles)

  // Filter out nocheck blocks
  const nocheckCount = allCodeBlocks.filter((b) => b.nocheck).length
  const codeBlocks = allCodeBlocks.filter((b) => !b.nocheck)

  yield* Console.log(
    `Extracted ${allCodeBlocks.length} TypeScript code blocks (${nocheckCount} skipped with nocheck)`
  )

  if (codeBlocks.length === 0) {
    yield* Console.log("No TypeScript code blocks to check")
    return 0
  }

  // Step 3: Create temp directory and run type-check with stub generation
  const result = yield*
    Effect.gen(function* () {
      const tempDir = yield* fs.makeTempDirectory({ prefix: "md-typecheck-" })
      const locations = yield* writeCodeBlocksToTemp(tempDir, codeBlocks)

      // Step 4: Install dependencies
      yield* Console.log("Installing dependencies in temp directory...", tempDir)
      yield* installDependencies(tempDir)

      // Step 5: First pass - identify missing symbols
      yield* Console.log("Running TypeScript type-check (pass 1: identify missing symbols)...")
      const firstPassOutput = yield* runTypeCheck(tempDir)
      const missingSymbols = extractMissingSymbols(firstPassOutput)

      if (missingSymbols.length > 0) {
        yield* Console.log(`  Found ${missingSymbols.length} missing symbols, generating stubs...`)

        // Append stubs to _globals.d.ts (already has all Effect types globally available)
        const stubsContent = generateStubs(missingSymbols, codeBlocks)
        const globalsPath = path.join(tempDir, "_globals.d.ts")
        const existingGlobals = yield* fs.readFileString(globalsPath).pipe(Effect.orDie)
        yield* fs.writeFileString(globalsPath, existingGlobals + stubsContent).pipe(Effect.orDie)

        // Step 6: Second pass - type-check with stubs
        yield* Console.log("Running TypeScript type-check (pass 2: with stubs)...")
        const secondPassOutput = yield* runTypeCheck(tempDir)
        return parseTypeScriptErrors(secondPassOutput, locations)
      }

      // No missing symbols, use first pass results
      return parseTypeScriptErrors(firstPassOutput, locations)
    }).pipe(Effect.scoped)

  // Step 7: Report results
  yield* Console.log("")
  if (result.length === 0) {
    yield* Console.log(`✓ All ${codeBlocks.length} code blocks type-check successfully`)
    return 0
  }

  // Calculate statistics
  const errorsByFile = new Map<string, number>()
  const errorsByCategory = new Map<string, number>()

  for (const error of result) {
    // Count by file (use relative path)
    const relPath = error.sourceFile.replace(process.cwd() + "/", "")
    errorsByFile.set(relPath, (errorsByFile.get(relPath) || 0) + 1)

    // Categorize errors (order matters - more specific checks first)
    let category = "Other"
    const msg = error.message
    if (msg.includes("yield") && msg.includes("reserved word")) {
      category = "⚠️  yield outside generator"
    } else if (msg.includes("arithmetic operation")) {
      category = "⚠️  Arithmetic (yield follow-on)"
    } else if (msg.includes("Cannot find name")) {
      category = "Missing symbol (stub failed)"
    } else if (msg.includes("implicitly has an 'any' type")) {
      category = "Implicit any"
    } else if (msg.includes("is of type 'unknown'")) {
      category = "Unknown type"
    } else if (msg.includes("Cannot redeclare") || msg.includes("Duplicate identifier") || msg.includes("Duplicate function")) {
      category = "Duplicate declaration"
    } else if (msg.includes("not assignable to type") || msg.includes("not assignable to parameter")) {
      category = "Type mismatch"
    } else if (msg.includes("Property") && msg.includes("does not exist")) {
      category = "Missing property/method"
    } else if (msg.includes("No overload matches")) {
      category = "Overload mismatch"
    } else if (msg.includes("Cannot use namespace") && msg.includes("as a type")) {
      category = "Namespace as type"
    } else if (msg.includes("must have a") && msg.includes("iterator")) {
      category = "Missing iterator"
    } else if (msg.includes("Import declaration conflicts")) {
      category = "Import conflict"
    } else if (msg.includes("Individual declarations") && msg.includes("merged")) {
      category = "Merged declaration"
    } else if (msg.includes("Binding element")) {
      category = "Implicit any"
    } else if (msg.includes("Expected") && msg.includes("arguments")) {
      category = "Wrong arg count"
    }
    errorsByCategory.set(category, (errorsByCategory.get(category) || 0) + 1)
  }

  // Sort by count descending
  const fileStats = [...errorsByFile.entries()].sort((a, b) => b[1] - a[1])
  const categoryStats = [...errorsByCategory.entries()].sort((a, b) => b[1] - a[1])

  // Print summary
  yield* Console.log(`✗ Found ${result.length} type errors in ${codeBlocks.length} code blocks`)
  yield* Console.log("")

  // Print errors by category
  yield* Console.log("═══════════════════════════════════════════════════════════════")
  yield* Console.log("  ERRORS BY CATEGORY")
  yield* Console.log("═══════════════════════════════════════════════════════════════")
  yield* Console.log("")
  for (const [category, count] of categoryStats) {
    const bar = "█".repeat(Math.min(Math.ceil(count / 5), 40))
    const pct = ((count / result.length) * 100).toFixed(1)
    yield* Console.log(`  ${String(count).padStart(4)}  ${bar} ${category} (${pct}%)`)
  }
  yield* Console.log("")

  // Print errors by file (top 15)
  yield* Console.log("═══════════════════════════════════════════════════════════════")
  yield* Console.log("  ERRORS BY FILE (top 15)")
  yield* Console.log("═══════════════════════════════════════════════════════════════")
  yield* Console.log("")
  for (const [file, count] of fileStats.slice(0, 15)) {
    const bar = "█".repeat(Math.min(Math.ceil(count / 2), 30))
    yield* Console.log(`  ${String(count).padStart(4)}  ${bar} ${file}`)
  }
  if (fileStats.length > 15) {
    const remaining = fileStats.slice(15).reduce((sum, [, c]) => sum + c, 0)
    yield* Console.log(`  ${String(remaining).padStart(4)}  ... and ${fileStats.length - 15} more files`)
  }
  yield* Console.log("")

  // Print recommendations based on top categories
  yield* Console.log("═══════════════════════════════════════════════════════════════")
  yield* Console.log("  RECOMMENDATIONS")
  yield* Console.log("═══════════════════════════════════════════════════════════════")
  yield* Console.log("")

  const yieldErrors = (errorsByCategory.get("⚠️  yield outside generator") || 0) +
    (errorsByCategory.get("⚠️  Arithmetic (yield follow-on)") || 0)
  if (yieldErrors > 0) {
    yield* Console.log(`  🔧 ${yieldErrors} yield errors: Wrap fragments in Effect.gen(function* () { ... })`)
    yield* Console.log("     or mark block with \`\`\`typescript nocheck")
    yield* Console.log("")
  }

  const duplicates = errorsByCategory.get("Duplicate declaration") || 0
  if (duplicates > 0) {
    yield* Console.log(`  🔧 ${duplicates} duplicate declarations: Use unique variable names per block`)
    yield* Console.log("     e.g., command1, command2 instead of reusing 'command'")
    yield* Console.log("")
  }

  const implicitAny = errorsByCategory.get("Implicit any") || 0
  if (implicitAny > 0) {
    yield* Console.log(`  🔧 ${implicitAny} implicit any: Add type annotations to parameters`)
    yield* Console.log("     e.g., (error: Error) => ... instead of (error) => ...")
    yield* Console.log("")
  }

  const typeMismatch = errorsByCategory.get("Type mismatch") || 0
  if (typeMismatch > 0) {
    yield* Console.log(`  🔧 ${typeMismatch} type mismatches: Check Effect type parameters match`)
    yield* Console.log("     Common: Effect<A, E, R> layers need proper dependencies")
    yield* Console.log("")
  }

  // Print detailed errors (optional, controlled by flag)
  const showDetails = process.argv.includes("--details") || process.argv.includes("-d")
  if (showDetails) {
    yield* Console.log("═══════════════════════════════════════════════════════════════")
    yield* Console.log("  DETAILED ERRORS")
    yield* Console.log("═══════════════════════════════════════════════════════════════")
    yield* Console.log("")
    for (const error of result) {
      const relPath = error.sourceFile.replace(process.cwd() + "/", "")
      yield* Console.log(`  ${relPath}:${error.sourceLine}:${error.sourceCol}`)
      yield* Console.log(`    ${error.message}`)
    }
  } else {
    yield* Console.log("  (use --details or -d to see individual errors)")
  }

  return 1
})

// ============================================================================
// Entry Point
// ============================================================================

pipe(
  program,
  Effect.flatMap((exitCode) => Effect.sync(() => process.exit(exitCode))),
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
)
