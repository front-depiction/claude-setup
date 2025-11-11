#!/usr/bin/env bun
/**
 * Agent Cleanup Stop Hook
 *
 * This hook runs when an agent stops to release all file locks
 * held by the agent.
 *
 * @category Hooks
 * @since 1.0.0
 */

import { Effect, pipe, Data, Layer, Context, Config, Console, Array, Record } from "effect"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { FileSystem, Path } from "@effect/platform"
import { Schema } from "@effect/schema"
import { FileLock, FileLocks } from "./schemas"

// ============================================================================
// Errors
// ============================================================================

/**
 * Error thrown when a required environment variable is missing
 *
 * @category Errors
 * @since 1.0.0
 */
export class MissingEnvError extends Data.TaggedError("MissingEnvError")<{
  readonly variable: string
}> { }


// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Config values using Effect Config module
 *
 * @category Config
 * @since 1.0.0
 */
const AgentIdConfig = Config.string("AGENT_ID").pipe(
  Config.withDefault("session-cleanup")
)

/**
 * Service providing access to environment-specific paths
 *
 * @category Services
 * @since 1.0.0
 */
export class EnvironmentConfig extends Context.Tag("EnvironmentConfig")<
  EnvironmentConfig,
  {
    readonly agentId: string
    readonly locksPath: string
  }
>() { }

/**
 * Layer that constructs EnvironmentConfig from Config module
 *
 * @category Layers
 * @since 1.0.0
 */
export const EnvironmentConfigLive = Layer.effect(
  EnvironmentConfig,
  Effect.gen(function* () {
    const agentId = yield* AgentIdConfig
    const path = yield* Path.Path

    return {
      agentId,
      locksPath: path.join(".claude", "coordination", "file-locks.json"),
    }
  })
)

// ============================================================================
// File Lock Operations
// ============================================================================

/**
 * Read and parse the file locks JSON
 *
 * @category Operations
 * @since 1.0.0
 * @example
 * ```ts
 * const locks = yield* readFileLocks
 * ```
 */
const readFileLocks = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const config = yield* EnvironmentConfig

  // Read file content with fallback to empty object
  const content = yield* pipe(
    fs.readFileString(config.locksPath),
    Effect.catchAll(() => Effect.succeed("{}"))
  )

  // Handle empty object case
  if (content.trim() === "{}") {
    return {} as Schema.Schema.Type<typeof FileLocks>
  }

  // Parse and validate JSON using Schema.parseJson
  return yield* pipe(
    Schema.decode(Schema.parseJson(FileLocks))(content),
  )
})

/**
 * Release all locks held by the current agent
 *
 * @category Operations
 * @since 1.0.0
 */
const releaseLocks = (
  agentId: string,
  locks: Schema.Schema.Type<typeof FileLocks>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const config = yield* EnvironmentConfig

    // Remove locks for current agent using Record.filter
    const updatedLocks = pipe(
      locks,
      Record.filter((lock) => lock.agentId !== agentId)
    )

    // Write updated locks
    const newContent = JSON.stringify(updatedLocks, null, 2)
    yield* fs.writeFileString(config.locksPath, newContent)

    const releasedCount = Record.size(locks) - Record.size(updatedLocks)
    yield* Console.log(`Released ${releasedCount} locks`)
  })

// ============================================================================
// Main Program
// ============================================================================

/**
 * Main cleanup program that orchestrates all cleanup operations
 *
 * @category Programs
 * @since 1.0.0
 */
const cleanupProgram = Effect.gen(function* () {
  yield* Console.log("Starting agent cleanup...")

  const config = yield* EnvironmentConfig
  yield* Console.log(`Agent ID: ${config.agentId}`)

  // Read file locks
  const locks = yield* readFileLocks
  yield* Console.log(`Found ${Record.size(locks)} total locks`)

  // Count files locked by current agent using Record.collect + Array.filter
  const lockedFileCount = pipe(
    locks,
    Record.collect((_, lock) => lock),
    Array.filter((lock) => lock.agentId === config.agentId),
    Array.length
  )
  yield* Console.log(`Found ${lockedFileCount} files locked by this agent`)

  // Release locks
  yield* Console.log("Releasing locks...")
  yield* releaseLocks(config.agentId, locks)

  yield* Console.log("Cleanup completed successfully")
  return 0
})

/**
 * Application layer combining all dependencies
 *
 * @category Layers
 * @since 1.0.0
 */
const AppLayer = EnvironmentConfigLive.pipe(Layer.provideMerge(BunContext.layer))


/**
 * Main entry point
 *
 * @category Main
 * @since 1.0.0
 */
const runnable = pipe(
  cleanupProgram,
  Effect.provide(AppLayer),
  Effect.catchAll((error) =>
    Console.error(`Cleanup error: ${error}`)
  )
)

BunRuntime.runMain(runnable)
