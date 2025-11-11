#!/usr/bin/env bun
/**
 * SessionStart Hook - Agent Initialization
 *
 * This hook runs when a new Claude session starts.
 * It generates a stable agent ID, exports it to the environment,
 * captures the project structure, and injects context.
 *
 * @module AgentInit
 * @since 1.0.0
 */

import { Effect, Console, Context, Layer, Data, Schema, pipe, Config } from "effect"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Command, CommandExecutor, FileSystem } from "@effect/platform"

// ============================================================================
// Schemas
// ============================================================================

/**
 * Configuration schema with validation
 *
 * @category Schema
 * @since 1.0.0
 */
const AgentConfigSchema = Schema.Struct({
  projectDir: Schema.String.pipe(Schema.nonEmptyString()),
  envFile: Schema.optional(Schema.String.pipe(Schema.nonEmptyString()))
})

type AgentConfigData = Schema.Schema.Type<typeof AgentConfigSchema>

/**
 * Agent ID format: agent-<timestamp>-<4-digit-random>
 *
 * @category Schema
 * @since 1.0.0
 */
const AgentIdSchema = Schema.String.pipe(
  Schema.pattern(/^agent-\d+-\d{4}$/),
  Schema.brand("AgentId")
)

type AgentId = Schema.Schema.Type<typeof AgentIdSchema>

/**
 * Context injection output structure
 *
 * @category Schema
 * @since 1.0.0
 */
const ContextOutputSchema = Schema.Struct({
  context: Schema.String
})

type ContextOutput = Schema.Schema.Type<typeof ContextOutputSchema>

// ============================================================================
// Error Types
// ============================================================================

/**
 * Configuration validation error
 *
 * @category Error
 * @since 1.0.0
 */
export class AgentConfigError extends Data.TaggedError("AgentConfigError")<{
  readonly reason: string
  readonly cause?: unknown
}> { }

/**
 * File operation error
 *
 * @category Error
 * @since 1.0.0
 */
export class FileOperationError extends Data.TaggedError("FileOperationError")<{
  readonly operation: string
  readonly path: string
  readonly cause?: unknown
}> { }

/**
 * Command execution error
 *
 * @category Error
 * @since 1.0.0
 */
export class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: string
  readonly reason: string
  readonly cause?: unknown
}> { }

// ============================================================================
// Services
// ============================================================================

/**
 * Configuration service - provides validated agent configuration
 *
 * @category Service
 * @since 1.0.0
 */
export class AgentConfig extends Context.Tag("AgentConfig")<
  AgentConfig,
  {
    readonly projectDir: string
    readonly envFile: string | undefined
  }
>() { }

/**
 * Agent ID generator service
 *
 * @category Service
 * @since 1.0.0
 */
export class AgentIdGenerator extends Context.Tag("AgentIdGenerator")<
  AgentIdGenerator,
  {
    readonly generate: () => Effect.Effect<AgentId, AgentConfigError>
  }
>() { }

/**
 * Project structure capture service
 *
 * @category Service
 * @since 1.0.0
 */
export class ProjectStructureCapture extends Context.Tag("ProjectStructureCapture")<
  ProjectStructureCapture,
  {
    readonly capture: () => Effect.Effect<string>
  }
>() { }

/**
 * Environment exporter service
 *
 * @category Service
 * @since 1.0.0
 */
export class EnvExporter extends Context.Tag("EnvExporter")<
  EnvExporter,
  {
    readonly exportAgentId: (agentId: AgentId) => Effect.Effect<void, FileOperationError>
  }
>() { }

/**
 * Context output service
 *
 * @category Service
 * @since 1.0.0
 */
export class ContextOutputter extends Context.Tag("ContextOutputter")<
  ContextOutputter,
  {
    readonly output: (agentId: AgentId, treeOutput: string) => Effect.Effect<void, AgentConfigError>
  }
>() { }

// ============================================================================
// Service Implementations
// ============================================================================

/**
 * Configuration Configs using Effect Config module
 *
 * @category Config
 * @since 1.0.0
 */
const ProjectDirConfig = pipe(
  Config.string("CLAUDE_PROJECT_DIR"),
  Config.withDefault(".")
)

const EnvFileConfig = Config.string("CLAUDE_ENV_FILE").pipe(
  Config.option
)

/**
 * Load and validate configuration from environment
 *
 * @category Layer
 * @since 1.0.0
 */
export const AgentConfigLive = Layer.effect(
  AgentConfig,
  Effect.gen(function* () {
    const projectDir = yield* ProjectDirConfig
    const envFileOption = yield* EnvFileConfig
    const envFile = envFileOption._tag === "Some" ? envFileOption.value : undefined

    // Validate configuration
    const config: AgentConfigData = yield* Schema.decode(AgentConfigSchema)({
      projectDir,
      envFile
    }).pipe(
      Effect.mapError((error) =>
        new AgentConfigError({
          reason: "Invalid configuration",
          cause: error
        })
      )
    )

    return AgentConfig.of({
      projectDir: config.projectDir,
      envFile: config.envFile
    })
  })
)

/**
 * Agent ID generator implementation
 *
 * @category Layer
 * @since 1.0.0
 */
export const AgentIdGeneratorLive = Layer.succeed(
  AgentIdGenerator,
  AgentIdGenerator.of({
    generate: () =>
      Effect.gen(function* () {
        const timestamp = Date.now()
        const random = Math.floor(1000 + Math.random() * 9000)
        const id = `agent-${timestamp}-${random}`

        return yield* Schema.decode(AgentIdSchema)(id).pipe(
          Effect.mapError((error) =>
            new AgentConfigError({
              reason: "Failed to generate valid agent ID",
              cause: error
            })
          )
        )
      })
  })
)

/**
 * Project structure capture implementation
 *
 * @category Layer
 * @since 1.0.0
 */
export const ProjectStructureCaptureLive = Layer.effect(
  ProjectStructureCapture,
  Effect.gen(function* () {
    const config = yield* AgentConfig
    const commandExecutor = yield* CommandExecutor.CommandExecutor

    return ProjectStructureCapture.of({
      capture: () =>
        pipe(
          Command.make("tree", "-L", "2", "-a"),
          Command.workingDirectory(config.projectDir),
          Command.string,
          Effect.catchAll((error) =>
            // Fallback if tree command is not available
            Effect.succeed(
              "(tree command not available - install with: brew install tree)"
            )
          ),
          Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
        )
    })
  })
)

/**
 * Environment exporter implementation
 *
 * @category Layer
 * @since 1.0.0
 */
export const EnvExporterLive = Layer.effect(
  EnvExporter,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const config = yield* AgentConfig

    return EnvExporter.of({
      exportAgentId: (agentId) =>
        Effect.gen(function* () {
          if (!config.envFile) {
            yield* Console.log(
              "Warning: CLAUDE_ENV_FILE not set, skipping environment export"
            )
            return
          }

          const envContent = `export AGENT_ID=${agentId}\n`

          // Read existing content, append new content, and write back
          const existingContent = yield* fs
            .readFileString(config.envFile)
            .pipe(Effect.catchAll(() => Effect.succeed("")))

          yield* fs
            .writeFileString(config.envFile, existingContent + envContent)
            .pipe(
              Effect.mapError((error) =>
                new FileOperationError({
                  operation: "write",
                  path: config.envFile!,
                  cause: error
                })
              )
            )

          yield* Console.log(
            `✓ Exported AGENT_ID=${agentId} to ${config.envFile}`
          )
        })
    })
  })
)

/**
 * Context outputter implementation
 *
 * @category Layer
 * @since 1.0.0
 */
export const ContextOutputterLive = Layer.effect(
  ContextOutputter,
  Effect.gen(function* () {
    const config = yield* AgentConfig

    return ContextOutputter.of({
      output: (agentId, treeOutput) =>
        Effect.gen(function* () {
          const contextMessage = [
            `You are ${agentId}`,
            `Operating in: ${config.projectDir}`,
            `File structure:`,
            treeOutput
          ].join("\n")

          const output: ContextOutput = {
            context: contextMessage
          }

          // Validate output structure
          yield* Schema.decode(ContextOutputSchema)(output).pipe(
            Effect.mapError((error) =>
              new AgentConfigError({
                reason: "Invalid context output structure",
                cause: error
              })
            )
          )

          // Output JSON to stdout for Claude to capture
          yield* Console.log("\n=== CONTEXT INJECTION ===")
          yield* Console.log(JSON.stringify(output, null, 2))
          yield* Console.log("=== END CONTEXT INJECTION ===\n")
        })
    })
  })
)

// ============================================================================
// Layer Composition
// ============================================================================

/**
 * Complete application layer with all dependencies
 *
 * @category Layer
 * @since 1.0.0
 *
 * Composition strategy:
 * - BunContext.layer provides FileSystem + CommandExecutor (+ Path, Terminal, Worker)
 * - AgentConfigLive needs no dependencies -> provides AgentConfig
 * - ProjectStructureCaptureLive needs AgentConfig + CommandExecutor -> provides ProjectStructureCapture
 */
export const AppLive = ProjectStructureCaptureLive.pipe(
  Layer.provideMerge(AgentConfigLive),
  Layer.provideMerge(BunContext.layer)
)

// ============================================================================
// Main Program
// ============================================================================

/**
 * Main program - orchestrates all initialization steps
 *
 * @category Program
 * @since 1.0.0
 */
const program = Effect.gen(function* () {

  const config = yield* AgentConfig
  const commandExecutor = yield* CommandExecutor.CommandExecutor

  // Capture project structure
  const structureCapture = yield* ProjectStructureCapture
  const treeOutput = yield* structureCapture.capture()

  // Get git status
  const gitStatus = yield* pipe(
    Command.make("git", "status", "--short"),
    Command.workingDirectory(config.projectDir),
    Command.string,
    Effect.catchAll(() => Effect.succeed("(not a git repository)")),
    Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
  )

  // Get recent commits
  const gitLog = yield* pipe(
    Command.make("git", "log", "--oneline", "-5"),
    Command.workingDirectory(config.projectDir),
    Command.string,
    Effect.catchAll(() => Effect.succeed("(no git history)")),
    Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
  )

  // Build context message
  const contextMessage = [
    `Operating in: ${config.projectDir}`,
    ``,
    `File structure:`,
    treeOutput,
    ``,
    `Git status:`,
    gitStatus || "(clean)",
    ``,
    `Recent commits:`,
    gitLog || "(none)"
  ].join("\n")

  // Output context
  yield* Console.log("\n=== CONTEXT INJECTION ===")
  yield* Console.log(contextMessage)
  yield* Console.log("=== END CONTEXT INJECTION ===\n")

})

/**
 * Runnable program with complete error handling and dependencies
 *
 * @category Runtime
 * @since 1.0.0
 */
const runnable = pipe(
  program,
  Effect.provide(AppLive),
  Effect.catchTags({
    AgentConfigError: (error) =>
      Console.error(`Configuration error: ${error.reason}`),
  }))

// ============================================================================
// Execution
// ============================================================================

// Execute the Effect program using BunRuntime
BunRuntime.runMain(runnable)
