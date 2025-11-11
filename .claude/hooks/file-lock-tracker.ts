#!/usr/bin/env bun

import { Effect, Console, pipe, Context, Layer, Data, Config } from "effect"
import { FileSystem, Terminal } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Schema } from "@effect/schema"

/**
 * Schema Definitions
 * @category Models
 */
const ToolUseInput = Schema.Struct({
  session_id: Schema.String,
  transcript_path: Schema.String,
  cwd: Schema.String,
  permission_mode: Schema.String,
  hook_event_name: Schema.String,
  tool_name: Schema.String,
  tool_input: Schema.Struct({
    file_path: Schema.optional(Schema.String),
    notebook_path: Schema.optional(Schema.String),
  }),
  tool_response: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  })),
})

const FileLock = Schema.Struct({
  agentId: Schema.String,
  timestamp: Schema.String,
  lastModified: Schema.String,
})

const FileLocks = Schema.Record({
  key: Schema.String,
  value: FileLock,
})

type ToolUseInput = Schema.Schema.Type<typeof ToolUseInput>
type FileLock = Schema.Schema.Type<typeof FileLock>
type FileLocks = Schema.Schema.Type<typeof FileLocks>

/**
 * Tagged Errors
 * @category Errors
 */
export class StdinReadError extends Data.TaggedError("StdinReadError")<{
  readonly cause: unknown
}> {}

export class JsonParseError extends Data.TaggedError("JsonParseError")<{
  readonly input: string
  readonly cause: unknown
}> {}

export class SchemaValidationError extends Data.TaggedError(
  "SchemaValidationError"
)<{
  readonly schemaName: string
  readonly cause: unknown
}> {}

export class ConfigMissingError extends Data.TaggedError("ConfigMissingError")<{
  readonly key: string
}> {}

export class FileSystemError extends Data.TaggedError("FileSystemError")<{
  readonly operation: string
  readonly path: string
  readonly cause: unknown
}> {}

/**
 * Config values using Effect Config module
 *
 * @category Config
 * @since 1.0.0
 */
const ProjectDirConfig = pipe(
  Config.nonEmptyString("CLAUDE_PROJECT_DIR"),
  Effect.mapError(() => new ConfigMissingError({ key: "CLAUDE_PROJECT_DIR" }))
)

const AgentIdConfig = pipe(
  Config.nonEmptyString("AGENT_ID"),
  Effect.mapError(() => new ConfigMissingError({ key: "AGENT_ID" }))
)

/**
 * Environment Configuration Service
 * @category Services
 */
export class HookConfig extends Context.Tag("HookConfig")<
  HookConfig,
  {
    readonly projectDir: string
    readonly agentId: string
  }
>() {}

/**
 * Layer for HookConfig - uses Config module
 * @category Layers
 */
export const HookConfigLive = Layer.effect(
  HookConfig,
  Effect.gen(function* () {
    const projectDir = yield* ProjectDirConfig
    const agentId = yield* AgentIdConfig

    return { projectDir, agentId }
  })
)

/**
 * Stdin Reader Service
 * @category Services
 */
export class StdinReader extends Context.Tag("StdinReader")<
  StdinReader,
  {
    readonly read: Effect.Effect<string, StdinReadError>
  }
>() {}

/**
 * Layer for StdinReader using Terminal service
 * @category Layers
 */
export const StdinReaderLive = Layer.effect(
  StdinReader,
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal

    return StdinReader.of({
      read: pipe(
        terminal.readLine,
        Effect.mapError((cause) => new StdinReadError({ cause }))
      )
    })
  })
)

/**
 * File Lock Repository Service
 * @category Services
 */
export class FileLockRepo extends Context.Tag("FileLockRepo")<
  FileLockRepo,
  {
    readonly read: Effect.Effect<FileLocks, FileSystemError>
    readonly write: (locks: FileLocks) => Effect.Effect<void, FileSystemError>
  }
>() {}

/**
 * Layer for FileLockRepo
 * @category Layers
 */
export const FileLockRepoLive = Layer.effect(
  FileLockRepo,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const config = yield* HookConfig
    const lockFilePath = `${config.projectDir}/.claude/coordination/file-locks.json`

    const read = pipe(
      fs.readFileString(lockFilePath),
      Effect.flatMap((content) =>
        pipe(
          Schema.decode(Schema.parseJson(FileLocks))(content),
          Effect.mapError(
            (cause) =>
              new FileSystemError({
                operation: "read",
                path: lockFilePath,
                cause,
              })
          )
        )
      ),
      // If file doesn't exist or is invalid, return empty locks
      Effect.catchAll(() => Effect.succeed({} as FileLocks))
    )

    const write = (locks: FileLocks) =>
      pipe(
        Schema.encode(Schema.parseJson(FileLocks))(locks),
        Effect.flatMap((content) => fs.writeFileString(lockFilePath, content)),
        Effect.mapError(
          (cause) =>
            new FileSystemError({
              operation: "write",
              path: lockFilePath,
              cause,
            })
        )
      )

    return { read, write }
  })
)

/**
 * Parse tool use input from JSON string
 * @category Parsing
 */
const parseToolUse = (
  input: string
): Effect.Effect<ToolUseInput, JsonParseError | SchemaValidationError> =>
  pipe(
    Schema.decode(Schema.parseJson(ToolUseInput))(input),
    Effect.mapError((cause) =>
      new SchemaValidationError({ schemaName: "ToolUseInput", cause })
    )
  )

/**
 * Update lock timestamp if the file is owned by the current agent
 * @category Domain Logic
 */
const updateLockIfOwned = (
  filePath: string,
  locks: FileLocks,
  agentId: string
): Effect.Effect<{ updated: boolean; locks: FileLocks }> =>
  Effect.sync(() => {
    const lock = locks[filePath]

    // No lock exists for this file
    if (!lock) {
      return { updated: false, locks }
    }

    // Lock exists but owned by different agent
    if (lock.agentId !== agentId) {
      return { updated: false, locks }
    }

    // Update lastModified timestamp for owned lock
    const updatedLocks = {
      ...locks,
      [filePath]: {
        ...lock,
        lastModified: new Date().toISOString(),
      },
    }

    return { updated: true, locks: updatedLocks }
  })

/**
 * Main program logic
 * @category Program
 */
const program = Effect.gen(function* () {
  const stdinReader = yield* StdinReader
  const lockRepo = yield* FileLockRepo
  const config = yield* HookConfig

  // Read and parse stdin
  const input = yield* stdinReader.read
  const toolUse = yield* parseToolUse(input)

  // If no file_path in input, exit gracefully
  const filePath = toolUse.tool_input.file_path ?? toolUse.tool_input.notebook_path
  if (!filePath) {
    yield* Console.log("No file_path in tool use, skipping lock update")
    return
  }

  // Read current locks
  const locks = yield* lockRepo.read

  // Update lock if owned by current agent
  const { updated, locks: updatedLocks } = yield* updateLockIfOwned(
    filePath,
    locks,
    config.agentId
  )

  if (updated) {
    yield* lockRepo.write(updatedLocks)
    yield* Console.log(`Updated lock for ${filePath}`)
  } else {
    yield* Console.log(
      `File ${filePath} not locked by agent ${config.agentId}, no update needed`
    )
  }
})

/**
 * Application layer - combines all dependencies
 * @category Layers
 *
 * Dependency graph:
 * - BunContext.layer provides FileSystem, Terminal, Path, etc.
 * - HookConfigLive provides HookConfig (no deps needed)
 * - StdinReaderLive needs Terminal -> provides StdinReader
 * - FileLockRepoLive needs FileSystem + HookConfig -> provides FileLockRepo
 */
const AppLive = Layer.mergeAll(
  StdinReaderLive,
  FileLockRepoLive
).pipe(
  Layer.provideMerge(HookConfigLive),
  Layer.provideMerge(BunContext.layer)
)

/**
 * Main entry point with error handling
 * @category Main
 */
const runnable = pipe(
  program,
  Effect.provide(AppLive),
  Effect.catchTags({
    StdinReadError: (error) =>
      Console.error(`Failed to read stdin: ${error.cause}`),
    JsonParseError: (error) =>
      Console.error(`Invalid JSON input: ${error.cause}`),
    SchemaValidationError: (error) =>
      Console.error(`Schema validation failed for ${error.schemaName}: ${error.cause}`),
    ConfigMissingError: (error) =>
      Console.error(`Required environment variable ${error.key} is not set`),
    FileSystemError: (error) =>
      Console.error(
        `File system error during ${error.operation} of ${error.path}: ${error.cause}`
      ),
  })
)

BunRuntime.runMain(runnable)
