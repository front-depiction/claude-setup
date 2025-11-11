// [LOCKED by 6b56d118-a654-4854-816e-e9d51439ac14 @ 2025-11-11T14:24:31.060Z]
/**
 * Stop Hook - Await Mailbox Messages
 *
 * Waits for incoming mailbox messages if COLLABORATION mode is enabled.
 * Uses FileSystem.watch() with Stream patterns to efficiently wait for messages.
 * Supports interruption via Ctrl+C.
 *
 * @since 1.0.0
 * @category Hooks
 */

import {
  Effect,
  Console,
  Context,
  Layer,
  Data,
  pipe,
  Stream,
  Option,
  Config,
  Array,
  Record,
  Predicate,
} from "effect"
import { FileSystem, Path, Terminal } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { ParseResult, Schema } from "@effect/schema"
import { waitFor } from "xstate"

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
 * Error when hook input fails validation
 * @category Errors
 */
export class InvalidHookInputError extends Data.TaggedError(
  "InvalidHookInputError"
)<{
  readonly cause: ParseResult.ParseError
}> { }

/**
 * Error when mailbox operations fail
 * @category Errors
 */
export class MailboxOperationError extends Data.TaggedError(
  "MailboxOperationError"
)<{
  readonly reason: string
  readonly cause?: unknown
}> { }

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for Stop hook input from stdin
 * @category Schemas
 */
const StopHookInput = Schema.Struct({
  session_id: Schema.String,
  transcript_path: Schema.String,
  cwd: Schema.String,
  hook_event_name: Schema.String,
  source: Schema.String, // "natural" or other
})

/**
 * Schema for a single request in the mailbox
 * @category Schemas
 */
const Request = Schema.Struct({
  from: Schema.String,
  message: Schema.String,
  timestamp: Schema.String,
})

/**
 * Schema for the complete mailboxes data structure
 * @category Schemas
 */
const Mailboxes = Schema.Record({
  key: Schema.String,
  value: Schema.Array(Request),
})

type StopHookInput = Schema.Schema.Type<typeof StopHookInput>
type Request = Schema.Schema.Type<typeof Request>
type Mailboxes = Schema.Schema.Type<typeof Mailboxes>

// ============================================================================
// Configuration Service
// ============================================================================

/**
 * Configuration service for mailbox awaiter
 * @category Services
 */
export class MailboxConfig extends Context.Tag("MailboxConfig")<
  MailboxConfig,
  {
    readonly mailboxFilePath: string
  }
>() { }

/**
 * Live implementation of MailboxConfig
 * Uses Path service to construct file paths
 * @category Layers
 */
export const MailboxConfigLive = Layer.effect(
  MailboxConfig,
  Effect.gen(function* () {
    const path = yield* Path.Path
    const mailboxFilePath = path.join(".claude", "coordination", "mailboxes.json")

    return MailboxConfig.of({
      mailboxFilePath,
    })
  })
)

// ============================================================================
// Mailbox Repository Service
// ============================================================================

/**
 * Repository service for mailbox persistence
 * @category Services
 */
export class MailboxRepository extends Context.Tag("MailboxRepository")<
  MailboxRepository,
  {
    readonly readMessages: (
      agentName: string
    ) => Effect.Effect<ReadonlyArray<Request>, MailboxOperationError>
    readonly removeMessages: (
      agentName: string
    ) => Effect.Effect<void, MailboxOperationError>
  }
>() { }

/**
 * Live implementation of MailboxRepository using FileSystem
 * @category Layers
 */
export const MailboxRepositoryLive = Layer.effect(
  MailboxRepository,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const config = yield* MailboxConfig
    const path = yield* Path.Path

    const readMailboxes: Effect.Effect<Mailboxes, MailboxOperationError> = pipe(
      fs.readFileString(config.mailboxFilePath),
      Effect.flatMap(Schema.decode(Schema.parseJson(Mailboxes))),
      Effect.mapError(
        (error) =>
          new MailboxOperationError({
            reason: "Failed to read mailboxes file",
            cause: error,
          })
      ),
    )

    const readMessages = (agentName: string) =>
      pipe(
        readMailboxes,
        Effect.map((mailboxes) => pipe(
          Record.get(mailboxes, agentName),
          Option.getOrElse(() => Array.empty())
        ))
      )

    const removeMessages = (agentName: string) =>
      Effect.gen(function* () {
        const mailboxes = yield* readMailboxes
        const messages = pipe(
          Record.get(mailboxes, agentName),
        )

        if (Option.isNone(messages)) {
          return
        }

        // Remove messages from mailbox
        const updatedMailboxes = pipe(
          mailboxes,
          Record.remove(agentName)
        )

        // Write updated mailboxes
        const mailboxDir = path.dirname(config.mailboxFilePath)
        yield* fs.makeDirectory(mailboxDir, { recursive: true }).pipe(
          Effect.catchAll(() => Effect.void)
        )

        const content = JSON.stringify(updatedMailboxes, null, 2)
        yield* fs.writeFileString(config.mailboxFilePath, content).pipe(
          Effect.mapError(
            (error) =>
              new MailboxOperationError({
                reason: "Failed to write mailboxes file",
                cause: error,
              })
          )
        )
      })

    return MailboxRepository.of({
      readMessages,
      removeMessages,
    })
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
      ),
    })
  })
)

// ============================================================================
// Hook Input Parser Service
// ============================================================================

/**
 * Service for parsing hook input
 * @category Services
 */
export class HookInputParser extends Context.Tag("HookInputParser")<
  HookInputParser,
  {
    readonly parse: (
      input: string
    ) => Effect.Effect<StopHookInput, InvalidHookInputError>
  }
>() { }

/**
 * Live implementation of HookInputParser using Schema
 * @category Layers
 */
export const HookInputParserLive = Layer.succeed(
  HookInputParser,
  HookInputParser.of({
    parse: (input: string) =>
      Schema.decode(Schema.parseJson(StopHookInput))(input).pipe(
        Effect.mapError((cause) => new InvalidHookInputError({ cause }))
      ),
  })
)

// ============================================================================
// Mailbox Awaiter Service
// ============================================================================

/**
 * Service for awaiting mailbox messages
 * @category Services
 */
export class MailboxAwaiter extends Context.Tag("MailboxAwaiter")<
  MailboxAwaiter,
  {
    readonly awaitMessages: (
      agentName: string
    ) => Effect.Effect<ReadonlyArray<Request>, MailboxOperationError>
  }
>() { }

/**
 * Format messages for display
 * @category Operations
 */
const formatMessages = (messages: ReadonlyArray<Request>): string => {
  if (Array.isEmptyReadonlyArray(messages)) return ""

  const header = "\n🔔 Messages Received:\n"
  const formattedMessages = Array.map(
    messages,
    (req) => `  - From ${req.from}: "${req.message}"`
  ).join("\n")

  return header + formattedMessages + "\n"
}

/**
 * Live implementation of MailboxAwaiter
 * Uses FileSystem.watch with Stream + takeUntil pattern
 * @category Layers
 */
export const MailboxAwaiterLive = Layer.effect(
  MailboxAwaiter,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const config = yield* MailboxConfig
    const repo = yield* MailboxRepository

    const awaitMessages = (agentName: string): Effect.Effect<ReadonlyArray<Request>, MailboxOperationError> =>
      Effect.gen(function* () {
        // Watch for changes using Stream + takeUntil pattern
        return yield* pipe(
          fs.watch(config.mailboxFilePath),
          Stream.mapError(
            (error) =>
              new MailboxOperationError({
                reason: "Failed to watch mailbox file",
                cause: error,
              })
          ),
          Stream.mapEffect(() => repo.readMessages(agentName)),
          Stream.filter(_ => Array.isNonEmptyReadonlyArray(_)),
          Stream.runHead,
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.never,  // No messages found - block forever
              onSome: (messages) => Effect.succeed(messages)
            })
          )
        )
      })

    return MailboxAwaiter.of({ awaitMessages })
  })
)

// ============================================================================
// Main Program Logic
// ============================================================================

/**
 * Main program that checks COLLABORATION mode and awaits messages
 * @category Program
 */
const program = Effect.gen(function* () {
  const awaiter = yield* MailboxAwaiter
  const repo = yield* MailboxRepository

  // Read agent name from environment (set by bash script)
  const agentName = yield* Config.string("AGENT_NAME")

  // Check for existing messages first
  const existing = yield* repo.readMessages(agentName)

  if (existing.length > 0) {
    const output = formatMessages(existing)
    yield* Console.log(output)
    return
  }

  const messages = yield* awaiter.awaitMessages(agentName)
  const output = formatMessages(messages)
  yield* Console.log(output)

  // Remove messages after displaying
  yield* repo.removeMessages(agentName)
}).pipe(
  Effect.tapError(Console.error)
)

// ============================================================================
// Application Layer
// ============================================================================

/**
 * Complete application layer with all dependencies
 * @category Layers
 *
 * Layer dependency graph:
 *   BunContext.layer -> FileSystem + Path
 *   MailboxConfigLive (needs Path) -> MailboxConfig
 *   MailboxRepositoryLive (needs FileSystem + MailboxConfig) -> MailboxRepository
 *   MailboxAwaiterLive (needs FileSystem + MailboxConfig + MailboxRepository) -> MailboxAwaiter
 *
 * Note: MailboxAwaiterLive depends on MailboxRepository, so we must provide it first
 * Session ID is read from SESSION_ID environment variable (set by bash wrapper)
 */
const AppLive =
  MailboxAwaiterLive.pipe(
    Layer.provideMerge(MailboxRepositoryLive),
    Layer.provideMerge(MailboxConfigLive),
    Layer.provideMerge(BunContext.layer)
  )

// ============================================================================
// Entry Point
// ============================================================================

/**
 * Main runnable effect with error handling and interruption support
 */
const runnable = pipe(
  program,
  Effect.provide(AppLive),

  // Handle interruption gracefully (Ctrl+C)
  Effect.onInterrupt(() =>
    Console.log("\n\n⚠️  Mailbox watch cancelled by user\n")
  ),

  // Handle errors silently (hook convention - non-critical feature)
  Effect.catchAll(() => Effect.void)
)

BunRuntime.runMain(runnable)
