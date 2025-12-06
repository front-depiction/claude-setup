/**
 * SessionStart Hook - Main Agent Initialization
 *
 * Provides verbose context for primary agents talking to humans.
 * Uses HTML-like syntax for all context enhancements.
 *
 * @module AgentInit
 * @since 1.0.0
 */

import { Effect, Console, Context, Layer, Data, Schema, pipe, Config } from "effect"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Command, CommandExecutor } from "@effect/platform"

// ============================================================================
// Schemas & Types
// ============================================================================

const AgentConfigSchema = Schema.Struct({
  projectDir: Schema.String.pipe(Schema.nonEmptyString()),
})

type AgentConfigData = Schema.Schema.Type<typeof AgentConfigSchema>

export class AgentConfigError extends Data.TaggedError("AgentConfigError")<{
  readonly reason: string
  readonly cause?: unknown
}> { }

// ============================================================================
// Services
// ============================================================================

export class AgentConfig extends Context.Tag("AgentConfig")<
  AgentConfig,
  { readonly projectDir: string }
>() { }

export class ProjectStructureCapture extends Context.Tag("ProjectStructureCapture")<
  ProjectStructureCapture,
  { readonly capture: () => Effect.Effect<string> }
>() { }

// ============================================================================
// Service Implementations
// ============================================================================

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

export const ProjectStructureCaptureLive = Layer.effect(
  ProjectStructureCapture,
  Effect.gen(function* () {
    const config = yield* AgentConfig
    const commandExecutor = yield* CommandExecutor.CommandExecutor

    return ProjectStructureCapture.of({
      capture: () =>
        pipe(
          Command.make("tree", "-L", "2", "-a", "-I", "node_modules|.git|dist|.turbo|build|.next|.cache|coverage"),
          Command.workingDirectory(config.projectDir),
          Command.string,
          Effect.catchAll(() => Effect.succeed("(tree unavailable)")),
          Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
        )
    })
  })
)

export const AppLive = ProjectStructureCaptureLive.pipe(
  Layer.provideMerge(AgentConfigLive),
  Layer.provideMerge(BunContext.layer)
)

// ============================================================================
// Main Program
// ============================================================================

const program = Effect.gen(function* () {
  const config = yield* AgentConfig
  const commandExecutor = yield* CommandExecutor.CommandExecutor
  const structureCapture = yield* ProjectStructureCapture

  // Capture all context in parallel
  const [treeOutput, gitStatus, gitLog, moduleSummary, projectVersion] = yield* Effect.all([
    structureCapture.capture(),
    pipe(
      Command.make("git", "status", "--short"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.catchAll(() => Effect.succeed("(not a git repository)")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    pipe(
      Command.make("git", "log", "--oneline", "-5"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.catchAll(() => Effect.succeed("(no git history)")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
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

  // Build HTML-like context output
  const output = `<session-context>
<cwd>${config.projectDir}</cwd>
<version>${projectVersion}</version>

<file-structure>
${treeOutput}
</file-structure>

<git-status>
${gitStatus || "(clean)"}
</git-status>

<git-log>
${gitLog || "(none)"}
</git-log>

${moduleSummary}

<available-commands>
<command name="/modules">List all ai-context modules with summaries</command>
<command name="/module [path]">Show full content of a specific module</command>
<command name="/module-search [pattern]">Search modules by glob pattern</command>
<command name="/definition [file] [line] [col]">Go to symbol definition</command>
<command name="/references [file] [line] [col]">Find symbol references</command>
<command name="/type-at [file] [line] [col]">Get TypeScript type at position</command>
<command name="/typecheck">Run TypeScript type checking</command>
</available-commands>
</session-context>`

  yield* Console.log(output)
})

const runnable = pipe(
  program,
  Effect.provide(AppLive),
  Effect.catchTags({
    AgentConfigError: (error) => Console.error(`<error>Config: ${error.reason}</error>`),
  })
)

BunRuntime.runMain(runnable)
