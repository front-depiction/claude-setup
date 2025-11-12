#!/usr/bin/env bun
/**
 * UserPromptSubmit Hook - Skill Suggester
 *
 * This hook runs when a user submits a prompt.
 * It dynamically reads skill files and analyzes the prompt for keywords.
 *
 * @category Hooks
 * @since 1.0.0
 */

import { Effect, Console, Data, pipe, Array as EffectArray, String as EffectString } from "effect"
import { Terminal, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Schema } from "@effect/schema"
import { UserPromptInput } from "./schemas"

/**
 * Tagged Errors
 */
export class StdinReadError extends Data.TaggedError("StdinReadError")<{
  readonly cause: unknown
}> { }

export class JsonParseError extends Data.TaggedError("JsonParseError")<{
  readonly input: string
  readonly cause: unknown
}> { }

export class SchemaDecodeError extends Data.TaggedError("SchemaDecodeError")<{
  readonly cause: unknown
}> { }

export class FileSystemError extends Data.TaggedError("FileSystemError")<{
  readonly cause: unknown
}> { }

/**
 * Skill metadata extracted from skill files
 */
interface SkillMetadata {
  readonly name: string
  readonly keywords: ReadonlyArray<string>
}

/**
 * Parse frontmatter from markdown file
 */
const parseFrontmatter = (content: string): Record<string, string> => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/
  const match = content.match(frontmatterRegex)

  if (!match) return {}

  const frontmatter = match[1]
  const lines = frontmatter.split("\n")

  return lines.reduce((acc, line) => {
    const [key, ...valueParts] = line.split(":")
    if (key && valueParts.length > 0) {
      acc[key.trim()] = valueParts.join(":").trim()
    }
    return acc
  }, {} as Record<string, string>)
}

/**
 * Extract keywords from description
 * Extracts meaningful words (3+ chars) and common technical terms
 */
const extractKeywords = (text: string): ReadonlyArray<string> => {
  // Remove common words and extract meaningful terms
  const commonWords = new Set([
    "the", "and", "for", "with", "using", "that", "this", "from",
    "are", "can", "will", "use", "used", "make", "makes", "create"
  ])

  return text
    .toLowerCase()
    .split(/[\s,.-]+/)
    .filter(word => word.length >= 3 && !commonWords.has(word))
}

/**
 * Output schema for skill suggestions
 * Following Claude Code's UserPromptSubmit hook format
 */
const SkillSuggestion = Schema.Struct({
  hookSpecificOutput: Schema.Struct({
    hookEventName: Schema.Literal("UserPromptSubmit"),
    additionalContext: Schema.String,
  }),
})

/**
 * Read a single skill file and extract metadata
 */
const readSkillFile = (skillPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const content = yield* fs.readFileString(skillPath).pipe(
      Effect.mapError(cause => new FileSystemError({ cause }))
    )

    const frontmatter = parseFrontmatter(content)
    const name = frontmatter.name || path.basename(path.dirname(skillPath))
    const description = frontmatter.description || ""

    // Extract keywords from both name and description
    const nameKeywords = extractKeywords(name)
    const descKeywords = extractKeywords(description)
    const keywords = [...new Set([...nameKeywords, ...descKeywords])]

    return { name, keywords } as SkillMetadata
  })

/**
 * Load all skills from the skills directory
 */
const loadSkills = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  // Use relative path - BunContext provides FileSystem relative to cwd
  // The shell script runs from project root
  const skillsDir = path.join(".claude", "skills")

  // Check if skills directory exists
  const exists = yield* fs.exists(skillsDir).pipe(
    Effect.mapError(cause => new FileSystemError({ cause }))
  )

  if (!exists) {
    return [] as ReadonlyArray<SkillMetadata>
  }

  // Read all subdirectories
  const entries = yield* fs.readDirectory(skillsDir).pipe(
    Effect.mapError(cause => new FileSystemError({ cause }))
  )

  // Read SKILL.md from each subdirectory
  const skills = yield* Effect.all(
    entries.map(entry =>
      readSkillFile(path.join(skillsDir, entry, "SKILL.md")).pipe(
        Effect.catchAll(() => Effect.succeed(null))
      )
    ),
    { concurrency: "unbounded" }
  )

  return skills.filter((s): s is SkillMetadata => s !== null)
})

/**
 * Case-insensitive keyword matching
 *
 * @category Utilities
 * @since 1.0.0
 */
const matchesKeyword = (prompt: string, keyword: string): boolean =>
  prompt.toLowerCase().includes(keyword.toLowerCase())

/**
 * Find all matching skills for a prompt
 *
 * @category Business Logic
 * @since 1.0.0
 */
const findMatchingSkills = (
  prompt: string,
  skills: ReadonlyArray<SkillMetadata>
): ReadonlyArray<string> =>
  skills
    .filter(skill =>
      skill.keywords.some(keyword => matchesKeyword(prompt, keyword))
    )
    .map(skill => skill.name)

/**
 * Format skill suggestions as context reminder
 *
 * @category Business Logic
 * @since 1.0.0
 */
const formatSkillSuggestion = (
  skills: ReadonlyArray<string>
) =>
  pipe(
    Effect.succeed({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit" as const,
        additionalContext: `💡 Relevant skills: ${skills.join(", ")}`,
      },
    }),
    Effect.flatMap((suggestion) =>
      Schema.encode(SkillSuggestion)(suggestion)
    ),
    Effect.map((encoded) => JSON.stringify(encoded))
  )

/**
 * Read stdin as a string using Terminal service
 *
 * @category I/O
 * @since 1.0.0
 */
const readStdin = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal
  return yield* pipe(
    terminal.readLine,
    Effect.mapError((cause) => new StdinReadError({ cause }))
  )
})

/**
 * Parse JSON input from stdin
 *
 * @category I/O
 * @since 1.0.0
 */
const parseJson = (input: string): Effect.Effect<unknown, JsonParseError> =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (cause) => new JsonParseError({ input, cause }),
  })

/**
 * Decode and validate input using schema
 *
 * @category I/O
 * @since 1.0.0
 */
const decodeUserPrompt = (
  raw: unknown
): Effect.Effect<UserPromptInput, SchemaDecodeError> =>
  pipe(
    Schema.decodeUnknown(UserPromptInput)(raw),
    Effect.mapError((cause) => new SchemaDecodeError({ cause }))
  )

/**
 * Output suggestion to stdout
 *
 * @category I/O
 * @since 1.0.0
 */
const outputSuggestion = (formatted: string): Effect.Effect<void> =>
  Console.log(formatted)

/**
 * Main program - orchestrates skill suggestion pipeline
 *
 * @category Main
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * // Input (stdin):
 * // {"prompt": "Help me create a service with dependency injection"}
 * //
 * // Output (stdout):
 * // {
 * //   "hookSpecificOutput": {
 * //     "hookEventName": "UserPromptSubmit",
 * //     "additionalContext": "💡 Relevant skills: service-implementation, layer-design"
 * //   }
 * // }
 * ```
 */
const program = Effect.gen(function* () {
  // Load all available skills
  const skills = yield* loadSkills

  // Read and parse stdin
  const stdin = yield* readStdin
  const rawInput = yield* parseJson(stdin)
  const input = yield* decodeUserPrompt(rawInput)

  // Find matching skills
  const matchingSkills = findMatchingSkills(input.prompt, skills)

  // Output suggestion if skills found (otherwise exit silently)
  if (matchingSkills.length > 0) {
    const formatted = yield* formatSkillSuggestion(matchingSkills)
    yield* outputSuggestion(formatted)
  }
})

/**
 * Runnable program with graceful error handling
 *
 * Exits with code 0 even on errors to avoid disrupting the hook system
 */
const runnable = pipe(
  program,
  Effect.provide(BunContext.layer),
  Effect.catchAll((error) =>
    Console.error(`Skill suggester encountered an error: ${error._tag}`)
  )
)

/**
 * Execute the Effect program using BunRuntime
 */
BunRuntime.runMain(runnable)
