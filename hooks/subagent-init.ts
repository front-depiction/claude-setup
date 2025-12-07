/**
 * SessionStart Hook - Sub-Agent Initialization
 *
 * Minimal initialization for sub-agents. Optimized for:
 * - Minimal token usage
 * - Fast startup
 * - Essential context only
 *
 * Uses HTML-like syntax for all context enhancements.
 *
 * @module SubAgentInit
 * @since 1.0.0
 */

import { Effect, Console, Context, Layer, Data, Schema, pipe, Config } from "effect"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Command, CommandExecutor } from "@effect/platform"

const AgentConfigSchema = Schema.Struct({
  projectDir: Schema.String.pipe(Schema.nonEmptyString()),
})

type AgentConfigData = Schema.Schema.Type<typeof AgentConfigSchema>

export class AgentConfigError extends Data.TaggedError("AgentConfigError")<{
  readonly reason: string
  readonly cause?: unknown
}> { }

export class AgentConfig extends Context.Tag("AgentConfig")<
  AgentConfig,
  { readonly projectDir: string }
>() { }

const ProjectDirConfig = pipe(
  Config.string("CLAUDE_PROJECT_DIR"),
  Config.withDefault(".")
)

export const AgentConfigLive = Layer.effect(
  AgentConfig,
  Effect.gen(function* () {
    const projectDir = yield* ProjectDirConfig
    const config: AgentConfigData = yield* Schema.decode(AgentConfigSchema)({
      projectDir,
    }).pipe(
      Effect.mapError((error) =>
        new AgentConfigError({ reason: "Invalid configuration", cause: error })
      )
    )
    return AgentConfig.of({ projectDir: config.projectDir })
  })
)

export const AppLive = AgentConfigLive.pipe(
  Layer.provideMerge(BunContext.layer)
)

const program = Effect.gen(function* () {
  const config = yield* AgentConfig
  const commandExecutor = yield* CommandExecutor.CommandExecutor

  const [moduleSummary, projectVersion] = yield* Effect.all([
    pipe(
      Command.make("bun", ".claude/scripts/context-crawler.ts", "--summary"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.catchAll(() => Effect.succeed("<modules count=\"0\">(unavailable)</modules>")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    pipe(
      Command.make("bun", "-e", "console.log(require('./package.json').version)"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.map(v => v.trim()),
      Effect.catchAll(() => Effect.succeed("unknown")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    )
  ], { concurrency: "unbounded" })

  // Minimal HTML-like context output
  const output = `<subagent-context>
<subagent_instructions>
<output_format>
Respond with code and file paths only. Skip explanations since the orchestrating
agent needs just the implementation. Provide a one-line summary when complete.
</output_format>

<code_elegance>
Find commonalities between patterns to create elegant, generalizable abstractions.
Deeply nested for-loops signal inelegance - consider recursion with Effect.suspend
where it simplifies. When lost in detail, step back to regain the bigger picture.
</code_elegance>

<use_lsp_commands>
Use /definition, /references, /rename, /type-at for code navigation. Faster and more
accurate than grep. For renaming or finding symbol usages, LSP is the correct tool.
</use_lsp_commands>

<type_integrity>
The goal is correct types, not passing type checks. Never use type casts, \`as any\`,
\`@ts-ignore\`, or \`@ts-expect-error\` to silence errors. If types fail across multiple
locations, step back and examine whether your data structures are typed correctly.
Work with the type system, not against it. When tempted to cast, consider whether
generics would let the types flow correctly - add type parameters to functions or
interfaces to preserve type information instead of erasing it with casts.
</type_integrity>
</subagent_instructions>

<cwd>${config.projectDir}</cwd>
<version>${projectVersion}</version>
${moduleSummary}
<commands>/modules /module [path] /module-search [pattern] /definition /references /type-at</commands>
</subagent-context>`

  yield* Console.log(output)
})

const runnable = pipe(
  program,
  Effect.provide(AppLive),
  Effect.catchTags({
    AgentConfigError: (error) => Console.error(`<error>${error.reason}</error>`),
  })
)

BunRuntime.runMain(runnable)
