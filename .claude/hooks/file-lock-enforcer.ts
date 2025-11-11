// [LOCKED by 1ec7ad43-a10c-41f8-95b4-4f00fdc98b88 @ 2025-11-10T13:12:16.140Z]

/**
 * File Lock Enforcer - PreToolUse Hook
 *
 * Enforces file locking to prevent concurrent modifications by multiple agents.
 * Uses Effect TypeScript with Bun platform for robust error handling and composable operations.
 *
 * @since 1.0.0
 */

import { Effect, Console, Context, Layer, Data, pipe, Option, Config, Duration, DateTime } from "effect"
import { FileSystem, Path, Terminal } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { ParseResult, Schema } from "@effect/schema"

// ============================================================================
// Tagged Errors
// ============================================================================

/**
 * Error when stdin cannot be read
 * @category Errors
 */
export class StdinReadError extends Data.TaggedError("StdinReadError")<{
  readonly cause: unknown
}> { }

/**
 * Error when tool input fails validation
 * @category Errors
 */
export class InvalidToolInputError extends Data.TaggedError(
  "InvalidToolInputError"
)<{
  readonly cause: ParseResult.ParseError
}> { }

/**
 * Error when file lock operations fail
 * @category Errors
 */
export class LockOperationError extends Data.TaggedError(
  "LockOperationError"
)<{
  readonly reason: string
  readonly cause?: unknown
}> { }

/**
 * Error when a file is locked by another agent
 * @category Errors
 */
export class FileLockDeniedError extends Data.TaggedError(
  "FileLockDeniedError"
)<{
  readonly filePath: string
  readonly lockedBy: string
  readonly acquiredAt: string
}> { }

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for tool use input from stdin
 * @category Schemas
 */
const ToolUseInput = Schema.Struct({
  session_id: Schema.String, // This is our agent ID!
  transcript_path: Schema.String,
  cwd: Schema.String,
  permission_mode: Schema.String,
  hook_event_name: Schema.String,
  tool_name: Schema.String,
  tool_input: Schema.Struct({
    file_path: Schema.optional(Schema.String),
    notebook_path: Schema.optional(Schema.String),
  }),
})

/**
 * Schema for a single file lock entry
 * @category Schemas
 */
const FileLockEntry = Schema.Struct({
  agentId: Schema.String,
  acquiredAt: Schema.String,
  lastModified: Schema.String,
})

/**
 * Schema for the complete file locks data structure
 * @category Schemas
 */
const FileLocksData = Schema.Record({
  key: Schema.String,
  value: FileLockEntry,
})

type ToolUseInput = Schema.Schema.Type<typeof ToolUseInput>
type FileLockEntry = Schema.Schema.Type<typeof FileLockEntry>
type FileLocksData = Schema.Schema.Type<typeof FileLocksData>

// ============================================================================
// Configuration Service
// ============================================================================

/**
 * Configuration service for file lock enforcer
 * Note: agentId removed - we use session_id from input instead
 * @category Services
 */
export class FileLockConfig extends Context.Tag("FileLockConfig")<
  FileLockConfig,
  {
    readonly lockFilePath: string
    readonly writeTools: ReadonlyArray<string>
  }
>() { }

/**
 * Live implementation of FileLockConfig from environment
 * Uses Path service to construct file paths
 * @category Layers
 */
export const FileLockConfigLive = Layer.effect(
  FileLockConfig,
  Effect.gen(function* () {
    const path = yield* Path.Path
    const lockFilePath = path.join(".claude", "coordination", "file-locks.json")

    return FileLockConfig.of({
      lockFilePath,
      writeTools: ["Write", "Edit", "NotebookEdit"],
    })
  })
)

// ============================================================================
// File Lock Repository Service
// ============================================================================

/**
 * Repository service for file lock persistence
 * @category Services
 */
export class FileLockRepository extends Context.Tag("FileLockRepository")<
  FileLockRepository,
  {
    readonly readLocks: Effect.Effect<FileLocksData>
    readonly writeLocks: (
      locks: FileLocksData
    ) => Effect.Effect<void, LockOperationError>
  }
>() { }



/**
 * Live implementation of FileLockRepository using FileSystem
 * @category Layers
 */
export const FileLockRepositoryLive = Layer.effect(
  FileLockRepository,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const config = yield* FileLockConfig
    const path = yield* Path.Path

    const readLocks: Effect.Effect<FileLocksData> = pipe(
      fs.readFileString(config.lockFilePath),
      Effect.flatMap(Schema.decode(Schema.parseJson(FileLocksData))),
      Effect.catchAll(() => Effect.succeed({} as FileLocksData))
    )

    const writeLocks = (locks: FileLocksData) =>
      pipe(
        Schema.encode(FileLocksData)(locks),
        Effect.map((data) => JSON.stringify(data, null, 2)),
        Effect.flatMap((content) =>
          Effect.gen(function* () {
            const lockDir = path.dirname(config.lockFilePath)

            // Ensure directory exists
            yield* fs.makeDirectory(lockDir, { recursive: true }).pipe(
              Effect.catchAll(() => Effect.void) // Ignore if already exists
            )

            // Write the file
            yield* fs.writeFileString(config.lockFilePath, content)
          })
        ),
        Effect.mapError(
          (error) =>
            new LockOperationError({
              reason: "Failed to write locks file",
              cause: error,
            })
        )
      )

    return FileLockRepository.of({ readLocks, writeLocks })
  })
)

// ============================================================================
// File Lock Service
// ============================================================================

/**
 * Service for managing file locks
 * @category Services
 */
export class FileLockService extends Context.Tag("FileLockService")<
  FileLockService,
  {
    readonly checkAndAcquireLock: (
      filePath: string,
      agentId: string
    ) => Effect.Effect<void, FileLockDeniedError | LockOperationError>
    readonly addLockComment: (
      filePath: string,
      agentId: string,
      timestamp: string
    ) => Effect.Effect<void>
  }
>() { }

/**
 * Add lock comment to file
 * @category Operations
 */
const addLockCommentToFile = (
  filePath: string,
  agentId: string,
  timestamp: string
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(filePath)

    if (!exists) {
      return // File doesn't exist yet (will be created by Write tool)
    }

    const content = yield* fs.readFileString(filePath)
    const lockComment = `// [LOCKED by ${agentId} @ ${timestamp}]\n`

    // Replace existing lock comment or add new one
    const newContent = content.startsWith("// [LOCKED by")
      ? pipe(
        content.split("\n"),
        (lines) => {
          lines[0] = lockComment.trim()
          return lines.join("\n")
        }
      )
      : lockComment + content

    yield* fs.writeFileString(filePath, newContent)
  })

/**
 * Live implementation of FileLockService
 * @category Layers
 */
export const FileLockServiceLive = Layer.effect(
  FileLockService,
  Effect.gen(function* () {
    const repo = yield* FileLockRepository
    const fs = yield* FileSystem.FileSystem

    const checkAndAcquireLock = (filePath: string, agentId: string) =>
      Effect.gen(function* () {
        const locks = yield* repo.readLocks
        const existingLock = locks[filePath]

        // If locked by another agent, deny access
        if (existingLock && existingLock.agentId !== agentId) {
          return yield* Effect.fail(
            new FileLockDeniedError({
              filePath,
              lockedBy: existingLock.agentId,
              acquiredAt: existingLock.acquiredAt,
            })
          )
        }

        // If already locked by this agent, allow
        if (existingLock && existingLock.agentId === agentId) return

        // Acquire new lock
        const timestamp = new Date().toISOString()
        const newLock: FileLockEntry = {
          agentId: agentId,
          acquiredAt: timestamp,
          lastModified: timestamp,
        }

        const updatedLocks = { ...locks, [filePath]: newLock }

        yield* repo.writeLocks(updatedLocks)
        yield* addLockCommentToFile(filePath, agentId, timestamp).pipe(
          Effect.catchAll((error) => Console.warn(`Warning: Failed to add lock comment: ${error}`)),
          Effect.provideService(FileSystem.FileSystem, fs)
        )
      })

    const addLockComment = (filePath: string, agentId: string, timestamp: string) =>
      addLockCommentToFile(filePath, agentId, timestamp).pipe(
        Effect.catchAll(() => Effect.void),
        Effect.provideService(FileSystem.FileSystem, fs)

      )

    return FileLockService.of({ checkAndAcquireLock, addLockComment })
  })
)

// ============================================================================
// Stdin Reader Service
// ============================================================================

/**
 * Service for reading stdin
 * @category Services
 */
export class StdinReader extends Context.Tag("StdinReader")<
  StdinReader,
  {
    readonly read: Effect.Effect<string, StdinReadError>
  }
>() { }

/**
 * Live implementation of StdinReader using Terminal service
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

// ============================================================================
// Tool Input Parser Service
// ============================================================================

/**
 * Service for parsing tool input
 * @category Services
 */
export class ToolInputParser extends Context.Tag("ToolInputParser")<
  ToolInputParser,
  {
    readonly parse: (
      input: string
    ) => Effect.Effect<ToolUseInput, InvalidToolInputError>
  }
>() { }

/**
 * Live implementation of ToolInputParser using Schema
 * @category Layers
 */
export const ToolInputParserLive = Layer.succeed(
  ToolInputParser,
  ToolInputParser.of({
    parse: (input: string) =>
      Schema.decode(Schema.parseJson(ToolUseInput))(input).pipe(
        Effect.mapError((cause) => new InvalidToolInputError({ cause }))
      ),
  })
)

// ============================================================================
// File Path Utilities
// ============================================================================

/**
 * Convert to absolute path (relative to cwd)
 * @category Utilities
 */
const toAbsolutePath = (filePath: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path

    if (path.isAbsolute(filePath)) {
      return filePath
    }

    // Resolve relative to current working directory
    return path.resolve(filePath)
  })

// ============================================================================
// Main Program Logic
// ============================================================================

/**
 * Check if tool requires lock enforcement
 * @category Operations
 */
const shouldEnforceLock = (
  input: ToolUseInput,
  writeTools: ReadonlyArray<string>
) =>
  Effect.gen(function* () {
    // Check if tool needs locking
    if (!writeTools.includes(input.tool_name)) {
      return Option.none<string>()
    }

    // Extract file path
    const filePath = input.tool_input.file_path ?? input.tool_input.notebook_path
    if (!filePath) {
      return Option.none<string>()
    }

    // Convert to absolute path
    const absolutePath = yield* toAbsolutePath(filePath)
    return Option.some(absolutePath)
  })

/**
 * Main program that enforces file locks
 * @category Program
 */
const program = Effect.gen(function* () {
  const stdinReader = yield* StdinReader
  const parser = yield* ToolInputParser
  const lockService = yield* FileLockService
  const config = yield* FileLockConfig

  // Read and parse input
  const input = yield* pipe(
    stdinReader.read,
    Effect.flatMap(parser.parse)
  )

  // Use session_id as the agent ID
  const agentId = input.session_id

  // Check if lock enforcement is needed
  const filePathOption = yield* shouldEnforceLock(input, config.writeTools)

  yield* pipe(
    filePathOption,
    Option.match({
      onNone: () => Effect.void,
      onSome: (filePath) => lockService.checkAndAcquireLock(filePath, agentId),
    })
  )
})

// ============================================================================
// Application Layer
// ============================================================================

/**
 * Complete application layer with all dependencies
 * @category Layers
 *
 * Composition strategy:
 * - BunContext.layer provides FileSystem + Path (+ CommandExecutor, Terminal, Worker)
 * - FileLockConfigLive needs Path -> provides FileLockConfig
 * - FileLockRepositoryLive needs FileSystem + FileLockConfig -> provides FileLockRepository
 * - FileLockServiceLive needs FileLockRepository + FileLockConfig -> provides FileLockService
 * - StdinReaderLive and ToolInputParserLive are independent (no requirements)
 *
 * Layer dependency graph:
 *   BunContext.layer -> FileSystem + Path
 *   FileLockConfigLive (needs Path) -> FileLockConfig
 *   FileLockRepositoryLive (needs FileSystem + FileLockConfig) -> FileLockRepository
 *   FileLockServiceLive (needs FileLockRepository + FileLockConfig) -> FileLockService
 *   StdinReaderLive -> StdinReader
 *   ToolInputParserLive -> ToolInputParser
 */


const AppLive = Layer.mergeAll(
  FileLockServiceLive,
  StdinReaderLive,
  ToolInputParserLive
).pipe(
  Layer.provide(FileLockRepositoryLive),
  Layer.provideMerge(FileLockConfigLive),
  Layer.provideMerge(BunContext.layer)
)

// ============================================================================
// Entry Point
// ============================================================================


/**
 * Main runnable effect with error handling
 */
const runnable = pipe(
  program,
  Effect.provide(AppLive),
  Effect.catchTags({
    FileLockDeniedError: (error) => Console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `File locked by ${error.lockedBy} since ${DateTime.distanceDuration(DateTime.unsafeNow(), DateTime.unsafeMake(error.acquiredAt)).pipe(Duration.format)}. Suggest coordination.`
      }
    }))
    ,
  }),
)

BunRuntime.runMain(runnable)
