---
name: command-executor
description: Execute system commands and manage processes using Effect's Command module from @effect/platform. Use this skill when spawning child processes, running shell commands, capturing command output, or managing long-running processes with cleanup.
---

# Command Execution with @effect/platform

## Overview

The `Command` module provides type-safe, testable process execution with automatic resource cleanup. Use this for spawning child processes, running shell commands, capturing output, and managing process lifecycles.

**When to use this skill:**
- Running shell commands or external programs
- Spawning child processes with controlled stdio
- Capturing command output (string, lines, stream)
- Managing long-running processes with cleanup
- Setting environment variables or working directories
- Piping commands together

**Note:** This skill covers the `Command` module for process execution, NOT `@effect/cli` for building CLI applications.

## Import Pattern

```typescript
import { Command, CommandExecutor } from "@effect/platform"
```

## Creating Commands

### Basic Command

```typescript
// Simple command with arguments
const command = Command.make("echo", "-n", "test")

// With working directory
const command = pipe(
  Command.make("npm", "install"),
  Command.workingDirectory("/path/to/project")
)

// With environment variables
const command = pipe(
  Command.make("node", "script.js"),
  Command.env({ NODE_ENV: "production", API_KEY: "xyz" })
)

// Control stdio streams
const command = pipe(
  Command.make("hardhat", "node"),
  Command.stdout("inherit"),  // "inherit" | "pipe" | "ignore"
  Command.stderr("inherit"),
  Command.workingDirectory(PROJECT_ROOT)
)
```

### Command Configuration Options

```typescript
// stdout/stderr modes:
// - "inherit": Pass through to parent process
// - "pipe": Capture for programmatic access
// - "ignore": Discard output

Command.stdout("pipe")    // Capture output
Command.stderr("inherit") // Show errors in console
Command.stdin(stream)     // Pipe stream as stdin
Command.feed(string)      // Feed string as stdin
```

## Executing Commands

### Capture as String

```typescript
const result = Effect.gen(function* () {
  const command = Command.make("echo", "-n", "hello")
  const output = yield* Command.string(command)
  // output: "hello"
  return output
})
```

### Capture as Lines

```typescript
const result = Effect.gen(function* () {
  const command = Command.make("ls", "-1")
  const lines = yield* Command.lines(command)
  // lines: string[]
  return lines
})
```

### Stream Output

```typescript
const result = Effect.gen(function* () {
  const command = Command.make("tail", "-f", "app.log")

  // As line stream
  const lineStream = Command.streamLines(command)
  yield* Stream.runForEach(lineStream, (line) => Console.log(line))

  // As byte stream
  const byteStream = Command.stream(command)
  yield* pipe(
    byteStream,
    Stream.mapChunks(Chunk.map((bytes) => decoder.decode(bytes))),
    Stream.runCollect
  )
})
```

### Get Exit Code

```typescript
const result = Effect.gen(function* () {
  const command = Command.make("test", "-f", "file.txt")
  const exitCode = yield* Command.exitCode(command)
  // exitCode: number (0 = success, non-zero = failure)
  return exitCode
})
```

## Process Management

### Start Process with Handle

```typescript
const program = Effect.gen(function* () {
  // Get the executor service
  const executor = yield* CommandExecutor.CommandExecutor

  const command = pipe(
    Command.make("bunx", "hardhat", "node"),
    Command.workingDirectory(PROJECT_ROOT),
    Command.stdout("inherit"),
    Command.stderr("inherit")
  )

  // Start returns a process handle
  const process = yield* executor.start(command)

  // Check if running
  const isRunning = yield* process.isRunning

  // Kill the process
  yield* process.kill("SIGTERM")  // or "SIGKILL", "SIGINT", etc.

  // Access streams (when stdout/stderr are "pipe")
  yield* Stream.runForEach(process.stdout, handleOutput)
})
```

### Automatic Cleanup with Finalizers

```typescript
const startHardhatNode = Effect.gen(function* () {
  const executor = yield* CommandExecutor.CommandExecutor

  const command = pipe(
    Command.make("bunx", "hardhat", "node"),
    Command.workingDirectory(PROJECT_ROOT),
    Command.stdout("inherit"),
    Command.stderr("inherit")
  )

  const process = yield* executor.start(command)

  // Register cleanup - runs when scope closes
  yield* Effect.addFinalizer(() =>
    process.kill("SIGTERM").pipe(Effect.ignoreLogged)
  )

  yield* waitForHardhat
  yield* Effect.log("Hardhat node ready")
})

// Usage with Scope
const program = pipe(
  startHardhatNode,
  Effect.scoped  // Automatically runs finalizers when scope ends
)
```

### Scoped Process Management

```typescript
const runWithProcess = Effect.gen(function* () {
  const command = Command.make("sleep", "100")

  // Process is scoped - automatically killed when scope closes
  const process = yield* Command.start(command)

  const isRunning = yield* process.isRunning
  // isRunning: true

  // Do work with process...

  // When this Effect completes, process is killed
}).pipe(Effect.scoped)
```

## Piping Commands

```typescript
const program = Effect.gen(function* () {
  // Pipe commands together like shell pipelines
  const command = pipe(
    Command.make("echo", "2\n1\n3"),
    Command.pipeTo(Command.make("sort")),
    Command.pipeTo(Command.make("head", "-2"))
  )

  const lines = yield* Command.lines(command)
  // lines: ["1", "2"]
})
```

## Error Handling

Commands fail with typed `SystemError`:

```typescript
const program = Effect.gen(function* () {
  const command = Command.make("non-existent-command")

  const result = yield* Command.string(command).pipe(
    Effect.catchTag("SystemError", (error) => {
      // error.reason: "NotFound" | "PermissionDenied" | etc
      // error.module: "Command"
      // error.method: "spawn"

      if (error.reason === "NotFound") {
        // Fallback to alternative command
        return Command.string(Command.make("alternative"))
      }
      return Effect.fail(error)
    })
  )
})
```

## Complete Example: E2E Test Setup

```typescript
import { Effect, Schedule, Scope, Exit, pipe } from "effect"
import { Command, CommandExecutor } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"

const PROJECT_ROOT = new URL("../", import.meta.url).pathname

// Check if service is ready
const checkReady = Effect.tryPromise({
  try: async () => {
    // Check if Hardhat is responding
    const client = createPublicClient({ transport: http("http://127.0.0.1:8545") })
    await client.getChainId()
    return true
  },
  catch: () => new Error("Service not ready"),
})

// Wait for service with retries
const waitForReady = pipe(
  checkReady,
  Effect.retry(
    Schedule.recurs(30).pipe(Schedule.addDelay(() => "500 millis"))
  ),
  Effect.timeout("30 seconds"),
  Effect.catchAll(() => Effect.fail(new Error("Failed to start")))
)

// Start long-running process
const startService = Effect.gen(function* () {
  const executor = yield* CommandExecutor.CommandExecutor

  const command = pipe(
    Command.make("bunx", "hardhat", "node"),
    Command.workingDirectory(PROJECT_ROOT),
    Command.stdout("inherit"),
    Command.stderr("inherit")
  )

  const process = yield* executor.start(command)

  // Cleanup when scope closes
  yield* Effect.addFinalizer(() =>
    process.kill("SIGTERM").pipe(Effect.ignoreLogged)
  )

  yield* waitForReady
  yield* Effect.log("Service ready")
})

// Run deployment command
const deploy = Effect.gen(function* () {
  const command = Command.make(
    "bunx", "hardhat", "ignition", "deploy",
    "ignition/modules/MyModule.ts",
    "--network", "localhost"
  ).pipe(Command.workingDirectory(PROJECT_ROOT))

  const result = yield* Command.string(command)

  if (result.includes("Error")) {
    yield* Effect.fail(new Error("Deploy failed"))
  }
})

// Setup with scope management
const testScope = Scope.make().pipe(Effect.runSync)

const setupProgram = pipe(
  startService,
  Effect.flatMap(() => deploy),
  Effect.provide(BunContext.layer),
  Scope.extend(testScope)
)

const teardownProgram = pipe(
  Effect.gen(function* () {
    yield* Effect.log("Cleaning up...")
    yield* Scope.close(testScope, Exit.void)
  }),
  Effect.provide(BunContext.layer)
)

// Vitest global setup
export async function setup() {
  await Effect.runPromise(setupProgram)
}

export async function teardown() {
  await Effect.runPromise(teardownProgram)
}
```

## Key Patterns

### 1. Always Use CommandExecutor for Process Handles

```typescript
// Get the executor service first
const executor = yield* CommandExecutor.CommandExecutor
const process = yield* executor.start(command)
```

### 2. Use Finalizers for Cleanup

```typescript
// Register cleanup that runs when scope closes
yield* Effect.addFinalizer(() =>
  process.kill("SIGTERM").pipe(Effect.ignoreLogged)
)
```

### 3. Scope Long-Running Processes

```typescript
// Wrap in Effect.scoped to ensure cleanup
const program = Effect.gen(function* () {
  const process = yield* Command.start(command)
  // ...
}).pipe(Effect.scoped)
```

### 4. Control stdio Based on Needs

```typescript
// Inherit for visibility (dev/debug)
Command.stdout("inherit")

// Pipe for programmatic access
Command.stdout("pipe")

// Ignore to suppress output
Command.stdout("ignore")
```

### 5. Handle Errors with catchTag

```typescript
yield* Command.string(command).pipe(
  Effect.catchTag("SystemError", (error) => {
    // Handle specific error reasons
    if (error.reason === "NotFound") { /* ... */ }
    if (error.reason === "PermissionDenied") { /* ... */ }
  })
)
```

## Testing

Commands are testable using Layer.mock:

```typescript
import { it } from "@effect/vitest"
import { Layer } from "effect"

it.effect("runs command", () =>
  Effect.gen(function* () {
    const output = yield* Command.string(Command.make("echo", "test"))
    expect(output).toBe("test")
  }).pipe(
    Effect.provide(
      Layer.mock(CommandExecutor.CommandExecutor, {
        start: () => Effect.succeed(mockProcess)
      })
    )
  )
)
```

## Common Gotchas

### 1. Don't Forget to Scope Process Management

```typescript
// ❌ WRONG - process leaks if program fails
const process = yield* executor.start(command)

// ✅ CORRECT - cleanup guaranteed
const process = yield* executor.start(command)
yield* Effect.addFinalizer(() => process.kill("SIGTERM").pipe(Effect.ignoreLogged))
```

### 2. Choose Correct stdio Mode

```typescript
// ❌ WRONG - can't capture output with "inherit"
Command.stdout("inherit")
const output = yield* Command.string(command)  // Empty!

// ✅ CORRECT - use "pipe" to capture
Command.stdout("pipe")
const output = yield* Command.string(command)
```

### 3. Use ignoreLogged for Finalizer Errors

```typescript
// ❌ WRONG - finalizer errors can mask original errors
yield* Effect.addFinalizer(() => process.kill("SIGTERM"))

// ✅ CORRECT - log but don't fail on cleanup errors
yield* Effect.addFinalizer(() => process.kill("SIGTERM").pipe(Effect.ignoreLogged))
```

## Related Skills

- **platform-abstraction**: File I/O, Path, FileSystem services
- **effect-testing**: Testing Effect programs with @effect/vitest
- **error-handling**: Typed error handling patterns with catchTag
