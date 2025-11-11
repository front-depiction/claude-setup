#!/usr/bin/env bun
/**
 * UserPromptSubmit Hook - Skill Suggester
 *
 * This hook runs when a user submits a prompt.
 * It analyzes the prompt for keywords and suggests relevant skills.
 *
 * @category Hooks
 * @since 1.0.0
 */

import { Effect, Console, Data, pipe, Layer } from "effect"
import { Terminal } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Schema } from "@effect/schema"
import { UserPromptInput } from "./schemas"

/**
 * Tagged Errors
 */
export class StdinReadError extends Data.TaggedError("StdinReadError")<{
  readonly cause: unknown
}> {}

export class JsonParseError extends Data.TaggedError("JsonParseError")<{
  readonly input: string
  readonly cause: unknown
}> {}

export class SchemaDecodeError extends Data.TaggedError("SchemaDecodeError")<{
  readonly cause: unknown
}> {}

/**
 * Skill mapping configuration
 */
const SKILL_KEYWORDS = {
  "atom-state": ["atom", "state", "react"],
  "service-implementation": ["service", "capability"],
  "layer-design": ["layer", "dependency", "di", "injection"],
  "domain-predicates": ["predicate", "order", "equivalence"],
  "typeclass-design": ["typeclass"],
  "context-witness": ["context", "witness"],
} as const

/**
 * Output schema for skill suggestions
 */
const SkillSuggestion = Schema.Struct({
  context: Schema.String,
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
const findMatchingSkills = (prompt: string): ReadonlyArray<string> =>
  Object.entries(SKILL_KEYWORDS)
    .filter(([_, keywords]) =>
      keywords.some((keyword) => matchesKeyword(prompt, keyword))
    )
    .map(([skill]) => skill)

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
      context: `💡 Relevant skills: ${skills.join(", ")}`,
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
 * // {"context": "💡 Relevant skills: service-implementation, layer-design"}
 * ```
 */
const program = Effect.gen(function* () {
  // Read and parse stdin
  const stdin = yield* readStdin
  const rawInput = yield* parseJson(stdin)
  const input = yield* decodeUserPrompt(rawInput)

  // Find matching skills
  const matchingSkills = findMatchingSkills(input.prompt)

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
    Effect.gen(function* () {
      // Log error details for debugging but exit gracefully
      yield* Console.error(
        `Skill suggester encountered an error: ${error._tag}`
      )
      // Return void to succeed (exit code 0) and not interrupt user workflow
    })
  )
)

/**
 * Execute the Effect program using BunRuntime
 */
BunRuntime.runMain(runnable)
