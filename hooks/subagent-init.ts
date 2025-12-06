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
<style>EXTREMELY TERSE. No prose. No explanations. Code/paths only. Brief comment when done.</style>
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
