#!/usr/bin/env bun
/**
 * PreToolUse Hook - Code Smell Detector
 *
 * Detects code smells in Edit/Write operations by:
 * 1. Reading stdin for tool use input
 * 2. Loading smell definitions from .claude/smells/*.md
 * 3. Matching file path against glob patterns
 * 4. Matching content against regex patterns
 * 5. Outputting detected smells as additional context
 *
 * Always exits 0 (non-blocking). Outputs nothing if no smells detected.
 *
 * @category Hooks
 * @since 1.0.0
 */

import { Effect, Console, pipe, Array, Record, Option, String, Config } from "effect"
import { Terminal, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import * as Schema from "effect/Schema"
/** Local type for smell detection */
type Smell = {
  readonly name: string
  readonly description: string
  readonly glob: string
  readonly pattern: string
  readonly tag: string
  readonly severity: "info" | "warning" | "error"
  readonly body: string
}

/**
 * Input schema for PreToolUse hook
 */
const ToolUseInput = Schema.Struct({
  tool_name: Schema.String,
  tool_input: Schema.Struct({
    file_path: Schema.optional(Schema.String),
    content: Schema.optional(Schema.String),
    new_string: Schema.optional(Schema.String),
  }),
})

type ToolUseInput = Schema.Schema.Type<typeof ToolUseInput>

/**
 * Output schema for PreToolUse hook
 */
const OutputSchema = Schema.Struct({
  hookSpecificOutput: Schema.Struct({
    hookEventName: Schema.Literal("PostToolUse"),
    additionalContext: Schema.String,
  }),
})

/**
 * Parse YAML frontmatter from markdown content
 */
const parseFrontmatter = (content: string): Record.ReadonlyRecord<string, string> => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/
  const match = content.match(frontmatterRegex)
  if (!match) return Record.empty()

  const frontmatter = match[1]
  const lines = String.split(frontmatter, "\n")

  const entries = Array.filterMap(lines, (line) =>
    pipe(
      line,
      String.indexOf(":"),
      Option.flatMap(colonIndex => {
        const key = String.trim(pipe(line, String.slice(0, colonIndex)))
        const rawValue = String.trim(pipe(line, String.slice(colonIndex + 1)))
        // Strip quotes from YAML values
        const value = rawValue.replace(/^["']|["']$/g, "")
        return String.isNonEmpty(key) && String.isNonEmpty(value)
          ? Option.some([key, value] as const)
          : Option.none()
      })
    )
  )

  return Record.fromEntries(entries)
}

/**
 * Extract body from markdown content (everything after frontmatter)
 */
const extractBody = (content: string): string => {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/
  return content.replace(frontmatterRegex, "").trim()
}

/**
 * Extract first paragraph from body text
 */
const extractFirstParagraph = (body: string): string => {
  const paragraphs = String.split(body, "\n\n")
  return Array.isNonEmptyReadonlyArray(paragraphs) ? paragraphs[0] : body
}

/**
 * Simple glob pattern matcher
 * Supports: *, **, ?, {a,b}
 */
const matchesGlob = (path: string, pattern: string): boolean => {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(",").join("|")})`) // {ts,tsx} → (ts|tsx)
    .replace(/\*\*/g, "___DOUBLESTAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/___DOUBLESTAR___/g, ".*")
    .replace(/\?/g, ".")

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(path)
}

/**
 * Count pattern occurrences in text
 */
const countMatches = (text: string, pattern: string): number => {
  try {
    const regex = new RegExp(pattern, "g")
    const matches = text.match(regex)
    return matches ? matches.length : 0
  } catch {
    return 0
  }
}

/**
 * Read and parse a smell definition file
 */
const readSmellFile = (smellPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const content = yield* fs.readFileString(smellPath)
    const frontmatter = parseFrontmatter(content)
    const body = extractBody(content)

    // Validate required fields using Record.get for safe access
    const name = pipe(frontmatter, Record.get("name"))
    const description = pipe(frontmatter, Record.get("description"))
    const glob = pipe(frontmatter, Record.get("glob"))
    const pattern = pipe(frontmatter, Record.get("pattern"))
    const tag = pipe(frontmatter, Record.get("tag"))
    const severityOpt = pipe(frontmatter, Record.get("severity"))

    // Check all required fields exist
    if (
      Option.isNone(name) ||
      Option.isNone(description) ||
      Option.isNone(glob) ||
      Option.isNone(pattern) ||
      Option.isNone(tag) ||
      Option.isNone(severityOpt)
    ) {
      return Option.none<Smell>()
    }

    const severity = severityOpt.value
    if (severity !== "info" && severity !== "warning" && severity !== "error") {
      return Option.none<Smell>()
    }

    return Option.some<Smell>({
      name: name.value,
      description: description.value,
      glob: glob.value,
      pattern: pattern.value,
      tag: tag.value,
      severity,
      body,
    })
  })

/**
 * Load all smell definitions from .claude/smells/*.md
 */
const loadSmells = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const projectDir = yield* Config.string("CLAUDE_PROJECT_DIR").pipe(
    Config.withDefault(".")
  )

  const smellsDir = path.join(projectDir, ".claude", "smells")
  const exists = yield* fs.exists(smellsDir)

  if (!exists) return Array.empty<Smell>()

  const entries = yield* fs.readDirectory(smellsDir)
  const smellFiles = Array.filter(entries, entry => String.endsWith(entry, ".md"))

  const smellEffects = Array.map(smellFiles, file =>
    Effect.option(readSmellFile(path.join(smellsDir, file)))
  )

  const smellOptions = yield* Effect.all(smellEffects, { concurrency: "unbounded" })
  // Effect.option wraps in Option, readSmellFile returns Option<Smell>
  // So we have Option<Option<Smell>> - need double unwrap
  return pipe(smellOptions, Array.getSomes, Array.getSomes)
})

/**
 * Detect smells in content for a given file path
 */
const detectSmells = (
  filePath: string,
  content: string,
  smells: ReadonlyArray<Smell>
): ReadonlyArray<{ smell: Smell; count: number }> =>
  Array.filterMap(smells, smell => {
    // Check if file path matches glob
    if (!matchesGlob(filePath, smell.glob)) {
      return Option.none()
    }

    // Check if content matches pattern
    const count = countMatches(content, smell.pattern)
    if (count === 0) {
      return Option.none()
    }

    return Option.some({ smell, count })
  })

/**
 * Format detected smells as XML output
 */
const formatSmells = (
  detections: ReadonlyArray<{ smell: Smell; count: number }>
): string => {
  if (!Array.isNonEmptyReadonlyArray(detections)) {
    return ""
  }

  const smellBlocks = Array.map(detections, ({ smell, count }) => {
    return `<${smell.tag}>
**${smell.name}** (${count} occurrence${count === 1 ? "" : "s"})

${smell.body}
</${smell.tag}>`
  })

  return `<code-smell-suggestions>\n${smellBlocks.join("\n\n")}\n</code-smell-suggestions>`
}

/**
 * Format output as JSON
 */
const formatOutput = (context: string) =>
  pipe(
    {
      hookSpecificOutput: {
        hookEventName: "PostToolUse" as const,
        additionalContext: context,
      },
    },
    Schema.encode(Schema.parseJson(OutputSchema))
  )

/**
 * Main program
 */
const program = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal

  // Read stdin
  const stdin = yield* terminal.readLine
  const input = yield* Schema.decode(Schema.parseJson(ToolUseInput))(stdin)

  // Only process Edit and Write tools
  if (input.tool_name !== "Edit" && input.tool_name !== "Write") {
    return
  }

  // Extract file path and content
  const filePath = input.tool_input.file_path
  if (!filePath) return

  const content = input.tool_name === "Edit"
    ? input.tool_input.new_string ?? ""
    : input.tool_input.content ?? ""

  if (!content) return

  // Load smell definitions
  const smells = yield* loadSmells

  // Detect smells
  const detections = detectSmells(filePath, content, smells)

  // Output if smells detected
  if (Array.isNonEmptyReadonlyArray(detections)) {
    const context = formatSmells(detections)
    const formatted = yield* formatOutput(context)
    yield* Console.log(formatted)
  }
})

/**
 * Run the program with error handling
 * Silent failure ensures tool calls are never blocked by hook errors
 */
const runnable = pipe(
  program,
  Effect.provide(BunContext.layer),
  Effect.catchAll(() => Effect.void)
)

BunRuntime.runMain(runnable)
