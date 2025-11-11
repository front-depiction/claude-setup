// [LOCKED by ce962776-c446-49c6-bda1-30fa517e3146 @ 2025-11-10T17:55:57.403Z]
/**
 * Mailbox Reader - PostToolUse Hook
 *
 * Checks the current agent's mailbox for incoming requests from other agents.
 * Displays any pending messages and removes them (pull-based queue).
 * Uses Effect TypeScript with Bun platform for robust error handling.
 *
 * @since 1.0.0
 */

import { Effect, Console, Context, Layer, Data, pipe, Array, Record, Option } from "effect"
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
 * Schema for hook input from stdin
 * @category Schemas
 */
const HookInput = Schema.Struct({
  session_id: Schema.String,
  transcript_path: Schema.String,
  cwd: Schema.String,
  permission_mode: Schema.String,
  hook_event_name: Schema.String,
  tool_name: Schema.String,
})

/**
 * Schema for a single request in the mailbox (object format)
 * @category Schemas
 */
const RequestObject = Schema.Struct({
  from: Schema.String,
  message: Schema.String,
  timestamp: Schema.String,
})

/**
 * Schema for request that can be either object or string
 * @category Schemas
 */
const Request = Schema.Union(
  RequestObject,
  Schema.String
)

/**
 * Schema for the complete mailboxes data structure
 * @category Schemas
 */
const Mailboxes = Schema.Record({
  key: Schema.String,
  value: Schema.Array(Request),
})

type HookInput = Schema.Schema.Type<typeof HookInput>
type RequestObject = Schema.Schema.Type<typeof RequestObject>
type Request = Schema.Schema.Type<typeof Request>
type Mailboxes = Schema.Schema.Type<typeof Mailboxes>

// ============================================================================
// Configuration Service
// ============================================================================

/**
 * Configuration service for mailbox reader
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
    readonly readMailboxes: Effect.Effect<Mailboxes>
    readonly writeMailboxes: (
      mailboxes: Mailboxes
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

    const readMailboxes: Effect.Effect<Mailboxes> = pipe(
      fs.readFileString(config.mailboxFilePath),
      Effect.flatMap(Schema.decode(Schema.parseJson(Mailboxes))),
      Effect.catchAll(() => Effect.succeed({} as Mailboxes))
    )

    const writeMailboxes = (mailboxes: Mailboxes) =>
      pipe(
        Schema.encode(Mailboxes)(mailboxes),
        Effect.map((data) => JSON.stringify(data, null, 2)),
        Effect.flatMap((content) =>
          Effect.gen(function* () {
            const mailboxDir = path.dirname(config.mailboxFilePath)

            // Ensure directory exists
            yield* fs.makeDirectory(mailboxDir, { recursive: true }).pipe(
              Effect.catchAll(() => Effect.void)
            )

            // Write the file
            yield* fs.writeFileString(config.mailboxFilePath, content)
          })
        ),
        Effect.mapError(
          (error) =>
            new MailboxOperationError({
              reason: "Failed to write mailboxes file",
              cause: error,
            })
        )
      )

    return MailboxRepository.of({ readMailboxes, writeMailboxes })
  })
)

// ============================================================================
// Mailbox Reader Service
// ============================================================================

/**
 * Service for reading and processing mailbox messages
 * @category Services
 */
export class MailboxReader extends Context.Tag("MailboxReader")<
  MailboxReader,
  {
    readonly checkAndDisplayMessages: (
      agentId: string
    ) => Effect.Effect<void, MailboxOperationError>
  }
>() { }

/**
 * Format messages for display
 * @category Operations
 */
const formatMessages = (messages: ReadonlyArray<Request>): string => {
  if (Array.isEmptyReadonlyArray(messages)) return ""

  const header = "\n📬 Your Mailbox:\n"
  const formattedMessages = Array.map(
    messages,
    (req) => {
      if (typeof req === "string") {
        return `  - Message: "${req}"`
      } else {
        return `  - From ${req.from}: "${req.message}"`
      }
    }
  ).join("\n")

  return header + formattedMessages + "\n"
}

/**
 * Live implementation of MailboxReader
 * @category Layers
 */
export const MailboxReaderLive = Layer.effect(
  MailboxReader,
  Effect.gen(function* () {
    const repo = yield* MailboxRepository

    const checkAndDisplayMessages = (agentId: string) =>
      Effect.gen(function* () {
        const mailboxes = yield* repo.readMailboxes
        const messages = pipe(
          Record.get(mailboxes, agentId),
          Option.getOrElse(Array.empty)
        )

        // If no messages, exit silently
        if (Array.isEmptyReadonlyArray(messages)) return

        // Display messages
        const output = formatMessages(messages)
        yield* Console.log(output)

        // Remove messages from mailbox (pull-based queue)
        const updatedMailboxes = pipe(
          mailboxes,
          Record.remove(agentId)
        )

        yield* repo.writeMailboxes(updatedMailboxes)
      })

    return MailboxReader.of({ checkAndDisplayMessages })
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
    ) => Effect.Effect<HookInput, InvalidHookInputError>
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
      Schema.decode(Schema.parseJson(HookInput))(input).pipe(
        Effect.mapError((cause) => new InvalidHookInputError({ cause }))
      ),
  })
)

// ============================================================================
// Main Program Logic
// ============================================================================

/**
 * Main program that checks mailbox and displays messages
 * @category Program
 */
const program = Effect.gen(function* () {
  const stdinReader = yield* StdinReader
  const parser = yield* HookInputParser
  const mailboxReader = yield* MailboxReader

  // Read and parse input
  const input = yield* pipe(
    stdinReader.read,
    Effect.flatMap(parser.parse)
  )

  // Use session_id as the agent ID
  const agentId = input.session_id

  // Check mailbox and display messages
  yield* mailboxReader.checkAndDisplayMessages(agentId)
})

// ============================================================================
// Application Layer
// ============================================================================

/**
 * Complete application layer with all dependencies
 * @category Layers
 *
 * Layer dependency graph:
 *   BunContext.layer -> FileSystem + Path + Terminal
 *   MailboxConfigLive (needs Path) -> MailboxConfig
 *   MailboxRepositoryLive (needs FileSystem + MailboxConfig) -> MailboxRepository
 *   MailboxReaderLive (needs MailboxRepository) -> MailboxReader
 *   StdinReaderLive (needs Terminal) -> StdinReader
 *   HookInputParserLive -> HookInputParser
 */
const AppLive = Layer.mergeAll(
  MailboxReaderLive,
  StdinReaderLive,
  HookInputParserLive
).pipe(
  Layer.provide(MailboxRepositoryLive),
  Layer.provideMerge(MailboxConfigLive),
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
  Effect.catchAll((error) =>
    // Silent failure - don't output errors to stdout
    // Errors are logged via the shell wrapper
    Effect.void
  )
)

BunRuntime.runMain(runnable)
