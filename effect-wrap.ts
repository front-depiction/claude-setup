
/// <reference types="bun-types" />
import { Context, Effect, Layer, pipe, Stream, Sink, Console } from "effect"
import { Command as PlatformCommand, CommandExecutor } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Args, CliApp, Command as CliCommand } from "@effect/cli"

/**
 * Service for transforming stdin streams before passing to subprocess.
 */
export class InputTransformer extends Context.Tag("InputTransformer")<
  InputTransformer,
  {
    readonly transform: (
      input: Stream.Stream<Uint8Array>
    ) => Stream.Stream<Uint8Array>
  }
>() { }

/**
 * Live implementation that replaces "hello" (case-insensitive) with
 * "hello from effect" in a line-safe way.
 *
 * We decode → split into lines → transform → re-join with newlines → encode.
 * This avoids missing matches that straddle chunk boundaries.
 */
export const InputTransformerLive = Layer.succeed(
  InputTransformer,
  InputTransformer.of({
    transform: (input) =>
      pipe(
        input,
        Stream.decodeText(),           // UTF-8 by default
        Stream.map((j) => j.replace("hi", "wowie")),
        Stream.encodeText,
        Sink.collectAll
      )
  })
)

/**
 * CLI command that forwards all args to `claude` and pipes transformed stdin.
 */
const claudeCommand = CliCommand.make(
  "claude-wrapper",
  {
    args: pipe(
      Args.text({ name: "argument" }),
      Args.withDescription("Arguments to pass to Claude Code"),
      Args.repeated
    )
  },
  ({ args }) =>
    Effect.gen(function* () {
      // Get services from context
      const executor = yield* CommandExecutor.CommandExecutor   // ✅ correct access pattern
      const transformer = yield* InputTransformer


      // Build the command; spread the variadic args
      const command = PlatformCommand.make("claude", ...args)

      // Execute with transformed stdin and inherited stdio
      const runningProcess = yield* pipe(
        command,
        command => (console.log(command), command),
        PlatformCommand.stdin("inherit"),
        PlatformCommand.stdout("inherit"),
        PlatformCommand.stderr("inherit"),
        executor.start                    // requires Scope
      )

      // Wait for completion
      const exitCode = yield* runningProcess.exitCode
      return exitCode
    }).pipe(Effect.scoped)                 // ✅ provide Scope for .start()
)

/**
 * CLI application configuration.
 */
const cli = CliApp.make({
  name: "Claude Code Wrapper",
  version: "1.0.0",
  command: claudeCommand
})

/**
 * Main program: runs the CLI and provides platform layers.
 */
const program = pipe(
  CliApp.run(cli, process.argv.slice(2), () => Effect.void),
  // Handle CLI validation errors cleanly
  Effect.catchTag("ValidationError", (e) =>
    Effect.sync(() => {
      console.error(e.message)
      process.exit(1)
    })
  ),
  // Provide services
  Effect.provide(InputTransformerLive),
  Effect.provide(BunContext.layer)         // CommandExecutor + Bun platform
)

// Run with Bun runtime
BunRuntime.runMain(program)

