#!/usr/bin/env bun
import { Effect, Console, pipe, Array, Option, Config, Order } from "effect"
import { Terminal, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import * as Schema from "effect/Schema"
import picomatch from "picomatch"
import { PatternFrontmatter, type PatternDefinition, PatternLevelOrder } from "../../patterns/schema"

const HookInput = Schema.Struct({
  hook_event_name: Schema.Literal("PreToolUse", "PostToolUse"),
  tool_name: Schema.String,
  tool_input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

type HookInput = Schema.Schema.Type<typeof HookInput>

const decodeHookInput = (json: string) =>
  Schema.decodeUnknown(HookInput)(JSON.parse(json))

const contentFields = ["command", "new_string", "content", "pattern", "query", "url", "prompt"] as const

const getMatchableContent = (input: Record<string, unknown>): string =>
  pipe(
    contentFields,
    Array.findFirst((field) => typeof input[field] === "string"),
    Option.flatMap((field) => Option.fromNullable(input[field] as string)),
    Option.getOrElse(() => JSON.stringify(input)),
  )

const getFilePath = (input: Record<string, unknown>): Option.Option<string> =>
  pipe(
    Option.fromNullable(input.file_path),
    Option.filter((v): v is string => typeof v === "string"),
  )

const parseYaml = (content: string): Record<string, unknown> => {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  return Object.fromEntries(
    match[1].split("\n")
      .map(line => line.match(/^(\w+):\s*["']?(.+?)["']?$/))
      .filter(Boolean)
      .map(m => [m![1], m![2]])
  )
}

const extractBody = (content: string): string =>
  content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim()

const testRegex = (text: string, pattern: string): boolean => {
  try { return new globalThis.RegExp(pattern).test(text) } catch { return false }
}

const testGlob = (filePath: string, glob: string): boolean => {
  try { return picomatch(glob)(filePath) } catch { return false }
}


const readPattern = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(filePath)
    const fm = yield* Schema.decodeUnknown(PatternFrontmatter)(parseYaml(content)).pipe(Effect.option)
    return Option.map(fm, f => ({
      name: f.name,
      description: f.description,
      event: f.event,
      tool: f.tool,
      glob: f.glob,
      pattern: f.pattern,
      action: f.action,
      level: f.level,
      tag: f.tag,
      body: extractBody(content),
      filePath,
    } as PatternDefinition))
  })

const loadPatterns = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const projectDir = yield* Config.string("CLAUDE_PROJECT_DIR").pipe(Config.withDefault("."))
  const root = path.join(projectDir, ".claude", "patterns")

  if (!(yield* fs.exists(root))) return [] as PatternDefinition[]

  const walk = (dir: string): Effect.Effect<PatternDefinition[], never, FileSystem.FileSystem> =>
    Effect.gen(function* () {
      const entries = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(() => []))

      const processEntry = (entry: string) =>
        Effect.gen(function* () {
          const full = path.join(dir, entry)
          const stat = yield* fs.stat(full).pipe(Effect.option)
          if (Option.isNone(stat)) return [] as PatternDefinition[]

          if (stat.value.type === "Directory") return yield* Effect.suspend(() => walk(full))

          if (entry.endsWith(".md")) {
            return yield* readPattern(full)
              .pipe(
                Effect.option,
                Effect.map(Option.flatten),
                Effect.map(Option.match({
                  onNone: () => Array.empty<PatternDefinition>(),
                  onSome: (pattern) => [pattern],
                }))
              )
          }

          return Array.empty<PatternDefinition>()
        })

      return yield* pipe(
        entries,
        Array.map(processEntry),
        Effect.all,
        Effect.map(Array.flatten),
      )
    })

  return yield* walk(root)
})

const matches = (input: HookInput, p: PatternDefinition): boolean => {
  const filePath = pipe(getFilePath(input.tool_input), Option.getOrUndefined)
  const content = getMatchableContent(input.tool_input)

  return (
    p.event === input.hook_event_name &&
    testRegex(input.tool_name, p.tool) &&
    (!p.glob || !filePath || testGlob(filePath, p.glob)) &&
    testRegex(content, p.pattern)
  )
}

const program = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal
  const input = yield* decodeHookInput(yield* terminal.readLine)
  const patterns = yield* loadPatterns

  const matchedPatterns = patterns.filter(p => matches(input, p))

  if (matchedPatterns.length === 0) return

  const context = matchedPatterns.filter(p => p.action === "context")
  const permission = matchedPatterns.filter(p => p.action !== "context")

  if (input.hook_event_name === "PostToolUse" && context.length > 0) {
    const blocks = context.map(p => {
      const tag = p.tag ?? "pattern-suggestion"
      return `<${tag}>\n${p.body}\n</${tag}>`
    })
    yield* Console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: blocks.join("\n\n")
      }
    }))
  }

  if (input.hook_event_name === "PreToolUse" && permission.length > 0) {
    const sorted = pipe(
      permission,
      Array.sort(Order.mapInput(PatternLevelOrder, (p: PatternDefinition) => p.level))
    )
    const primary = sorted[0]

    yield* Console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: primary.action,
        permissionDecisionReason: primary.body
      }
    }))
  }
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer), Effect.catchAll(() => Effect.void)))
