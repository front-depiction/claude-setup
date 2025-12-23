#!/usr/bin/env bun
/**
 * UserPromptSubmit Hook - System Reminder
 *
 * Provides contextual reminders on each prompt:
 * - Always: Relevant skills based on prompt keywords
 * - Probabilistic: Concurrency tips, available commands
 *
 * Uses HTML-like syntax for all context enhancements.
 *
 * @category Hooks
 * @since 1.0.0
 */

import { Effect, Console, pipe, Array, Record, Option, String } from "effect"
import { Terminal, FileSystem, Path, Command, CommandExecutor } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { UserPromptInput } from "./schemas"
import * as Schema from "effect/Schema"

interface SkillMetadata {
  readonly name: string
  readonly keywords: ReadonlyArray<string>
}

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
        const key = pipe(line, String.slice(0, colonIndex), String.trim)
        const value = pipe(line, String.slice(colonIndex + 1), String.trim)
        return String.isNonEmpty(key) && String.isNonEmpty(value)
          ? Option.some([key, value] as const)
          : Option.none()
      })
    )
  )

  return Record.fromEntries(entries)
}

const extractKeywords = (text: string): ReadonlyArray<string> => {
  const commonWords = new Set([
    "the", "and", "for", "with", "using", "that", "this", "from",
    "are", "can", "will", "use", "used", "make", "makes", "create"
  ])

  const lowercased = String.toLowerCase(text)
  const words = String.split(lowercased, /[\s,.-]+/)

  return Array.filter(words, word =>
    String.length(word) >= 3 && !commonWords.has(word)
  )
}

const OutputSchema = Schema.Struct({
  hookSpecificOutput: Schema.Struct({
    hookEventName: Schema.Literal("UserPromptSubmit"),
    additionalContext: Schema.String,
  }),
})

const readSkillFile = (skillPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const content = yield* fs.readFileString(skillPath)
    const frontmatter = parseFrontmatter(content)
    const name = frontmatter.name || path.basename(path.dirname(skillPath))
    const description = frontmatter.description || ""

    const nameKeywords = extractKeywords(name)
    const descKeywords = extractKeywords(description)
    const keywords = Array.dedupe(Array.appendAll(nameKeywords, descKeywords))

    return { name, keywords }
  })

const loadSkills = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const skillsDir = path.join(".claude", "skills")
  const exists = yield* fs.exists(skillsDir)

  if (!exists) return Array.empty<SkillMetadata>()

  const entries = yield* fs.readDirectory(skillsDir)
  const skillEffects = Array.map(entries, entry =>
    Effect.option(readSkillFile(path.join(skillsDir, entry, "SKILL.md")))
  )

  const skillOptions = yield* Effect.all(skillEffects, { concurrency: "unbounded" })
  return Array.getSomes(skillOptions)
})

const matchesKeyword = (prompt: string, keyword: string): boolean =>
  pipe(String.toLowerCase(prompt), String.includes(String.toLowerCase(keyword)))

const findMatchingSkills = (
  prompt: string,
  skills: ReadonlyArray<SkillMetadata>
): ReadonlyArray<string> =>
  Array.filterMap(skills, skill =>
    Array.some(skill.keywords, keyword => matchesKeyword(prompt, keyword))
      ? Option.some(skill.name)
      : Option.none()
  )

const searchModules = (prompt: string, cwd: string) =>
  Effect.gen(function* () {
    const commandExecutor = yield* CommandExecutor.CommandExecutor

    // Extract significant words from prompt for search
    const words = pipe(
      prompt,
      String.toLowerCase,
      String.split(/\s+/),
      Array.filter(w => String.length(w) >= 4)
    )

    if (!Array.isNonEmptyReadonlyArray(words)) return Option.none<string>()

    // Use first significant word as search pattern
    const pattern = words[0]

    const result = yield* pipe(
      Command.make("bun", ".claude/scripts/context-crawler.ts", "--search", pattern),
      Command.workingDirectory(cwd),
      Command.string,
      Effect.catchAll(() => Effect.succeed("")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    )

    // Parse count from output
    const countMatch = result.match(/count="(\d+)"/)
    const count = countMatch ? parseInt(countMatch[1], 10) : 0

    if (count === 0) return Option.none<string>()

    return Option.some(result.trim())
  })

const formatOutput = (context: string) =>
  pipe(
    {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit" as const,
        additionalContext: context,
      },
    },
    Schema.encode(Schema.parseJson(OutputSchema))
  )

const program = Effect.gen(function* () {
  const skills = yield* loadSkills
  const terminal = yield* Terminal.Terminal

  const stdin = yield* terminal.readLine
  const input = yield* Schema.decode(Schema.parseJson(UserPromptInput))(stdin)

  const matchingSkills = findMatchingSkills(input.prompt, skills)

  // Search for matching modules based on user input
  const moduleSearchResult = yield* searchModules(input.prompt, input.cwd)


  // Build context parts
  const parts: string[] = []

  // Always show matched skills if any
  if (Array.isNonEmptyReadonlyArray(matchingSkills)) {
    parts.push(`<skills>${matchingSkills.join(", ")}</skills>`)
  }

  // Always show matching modules if found
  if (Option.isSome(moduleSearchResult)) {
    parts.push(`<relevant-modules>\n${moduleSearchResult.value}\n</relevant-modules>`)
  }

  // Always: Remind about context efficiency
  parts.push(`<context_efficiency>
preserve :: Context → Effect ()
preserve ctx = do
  exploration ← spawn ExploreAgent query
  await exploration                    -- subagent reads, you coordinate
  -- ¬read files directly unless decision-critical
</context_efficiency>`)

  // Always: Remind about delegation
  parts.push(`<delegation_strategy>
delegate :: Task → Effect [Agent]
delegate task
  | atomic task     = pure <$> spawn task
  | otherwise       = parallel $ fmap delegate (decompose task)

-- invariant: |agents| ≥ 5 ∨ reconsider decomposition
-- self = coordinator, ¬implementer
</delegation_strategy>`)

  // Always: Delegation prompting guidance
  parts.push(`<delegation_prompts>
prompt :: Agent → Task → Effect ()
prompt agent task = do
  specify (what task)              -- clear objective
  specify (how task)               -- high-level approach
  direct agent "/modules"          -- check patterns
  direct agent ".context/"         -- check decisions
  direct agent "/typecheck dir"    -- validate incrementally, not globally
</delegation_prompts>`)

  // Always: Remind about concurrency
  parts.push(`<parallel_execution>
execute :: [Tool] → Effect [Result]
execute tools = case partition independent tools of
  (parallel, sequential) → do
    p ← parallel $ fmap call parallel   -- single message
    s ← traverse call sequential
    pure $ p <> s
</parallel_execution>`)

  // Always: Remind about module commands
  parts.push(`<context_discovery>
discover :: Effect Context
discover = do
  modules ← "/modules"              -- list ai-context modules
  content ← "/module" path          -- read specific module
  matches ← "/module-search" pat    -- search by pattern
  pure $ Context modules content matches
</context_discovery>`)

  // Always: Show version
  const commandExecutor = yield* CommandExecutor.CommandExecutor
  const version = yield* pipe(
    Command.make("bun", "-e", "console.log(require('./package.json').version)"),
    Command.workingDirectory(input.cwd),
    Command.string,
    Effect.map(v => v.trim()),
    Effect.catchAll(() => Effect.succeed("unknown")),
    Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
  )
  parts.push(`<version>${version}</version>`)

  // Only output if we have content
  if (parts.length > 0) {
    const context = `<system-hints>\n${parts.join("\n")}\n</system-hints>`
    const formatted = yield* formatOutput(context)
    yield* Console.log(formatted)
  }
})

const runnable = pipe(
  program,
  Effect.provide(BunContext.layer),
  Effect.catchAll(() => Effect.void)
)

BunRuntime.runMain(runnable)
