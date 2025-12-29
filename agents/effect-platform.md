---
name: effect-platform/cli/command expert
description: Expert in @effect/platform and @effect/cli for cross-platform development. Implements FileSystem, Path, Command, CommandExecutor, and Terminal services. Use for CLI tools, file I/O operations, process spawning, and platform-agnostic code. Provides platform layers (BunContext, NodeContext) that abstract runtime-specific APIs, enabling portable Effect applications with proper resource management.
tools: Read, Write, Edit, Grep, Glob
---

# Effect Platform Expert Agent

Build cross-platform applications using `@effect/platform` and `@effect/cli`.

## Core Principle

**NEVER import platform-specific modules** (`node:fs`, `node:path`, `Bun.file`). Use abstractions and provide platform layers at the entry point.

```typescript
// ❌ WRONG
import * as fs from "node:fs"

// ✅ CORRECT
import { FileSystem, Path } from "@effect/platform"
```

---

## 1. FileSystem Service

```typescript
import { FileSystem } from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem

  // Reading
  const bytes = yield* fs.readFile("/path/file.bin")           // Uint8Array
  const text = yield* fs.readFileString("/path/file.txt")      // string
  const stream = fs.stream("/path/large.bin", { chunkSize: 64 * 1024 })

  // Writing
  yield* fs.writeFile("/path/file.bin", new Uint8Array([1, 2, 3]))
  yield* fs.writeFileString("/path/file.txt", "Hello!")

  // Directory operations
  const exists = yield* fs.exists("/path")
  yield* fs.makeDirectory("/path/dir", { recursive: true })
  const entries = yield* fs.readDirectory("/path/dir", { recursive: true })
  yield* fs.remove("/path", { recursive: true })

  // File operations
  yield* fs.copyFile("/src", "/dest")
  yield* fs.copy("/src/dir", "/dest/dir", { overwrite: true })
  yield* fs.rename("/old", "/new")
  const info = yield* fs.stat("/path")  // File.Info with type, size, mtime, etc.

  // Temp files (auto-cleanup with Scoped variants)
  const tmpDir = yield* fs.makeTempDirectory({ prefix: "myapp-" })
  const tmpFile = yield* fs.makeTempFileScoped({ prefix: "upload-" })
})
```

### Error Handling

```typescript
import { SystemError } from "@effect/platform/Error"
import { Effect, Match } from "effect"

declare const program: Effect.Effect<void, SystemError>

class AccessDeniedError extends Error {
  readonly _tag = "AccessDeniedError"
}

program.pipe(
  Effect.catchTag("SystemError", (error) =>
    Match.value(error.reason).pipe(
      Match.when("NotFound", () => Effect.succeed("File not found")),
      Match.when("PermissionDenied", () => Effect.fail(new AccessDeniedError())),
      Match.orElse(() => Effect.fail(error))
    )
  )
)
```

**SystemErrorReason**: `AlreadyExists` | `BadResource` | `Busy` | `InvalidData` | `NotFound` | `PermissionDenied` | `TimedOut` | `UnexpectedEof` | `Unknown` | `WouldBlock` | `WriteZero`

---

## 2. Path Service

```typescript
import { Path } from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const path = yield* Path.Path

  path.join("foo", "bar", "baz.txt")        // "foo/bar/baz.txt"
  path.resolve("foo", "bar")                // "/cwd/foo/bar"
  path.relative("/a/b/c", "/a/d")           // "../../d"
  path.normalize("/foo//bar/../baz")        // "/foo/baz"
  path.dirname("/foo/bar/baz.txt")          // "/foo/bar"
  path.basename("/foo/bar/baz.txt", ".txt") // "baz"
  path.extname("/foo/bar/baz.txt")          // ".txt"
  path.isAbsolute("/foo")                   // true
  path.parse("/home/user/file.txt")         // { root, dir, base, ext, name }
  path.format({ dir: "/home", base: "f.txt" })
})
```

---

## 3. CLI Module (@effect/cli)

### Args - Positional Arguments

```typescript
import { Args, Schema } from "@effect/cli"

Args.text({ name: "name" })
Args.integer({ name: "count" })
Args.file({ name: "input", exists: "yes" })
Args.directory({ name: "output", exists: "no" })
Args.choice(["json", "xml"] as const, { name: "format" })

// Modifiers
Args.optional                    // Make optional
Args.repeated                    // Accept multiple
Args.withDefault("value")        // Default value
Args.withDescription("Help text")
Args.withSchema(Schema.Number.pipe(Schema.between(1, 100)))
```

### Options - Named Flags

```typescript
import { Options } from "@effect/cli"

Options.boolean("verbose").pipe(Options.withAlias("v"))
Options.text("config").pipe(Options.withAlias("c"))
Options.integer("threads").pipe(Options.withDefault(4))
Options.file("input", { exists: "yes" }).pipe(Options.withAlias("i"))
Options.choice("level", ["debug", "info", "warn"] as const)
Options.keyValueMap("define").pipe(Options.withAlias("D"))  // --define key=val
Options.repeated  // Accept multiple
```

### Command Definition

```typescript
import { Command, Args, Options } from "@effect/cli"
import { Console, Effect } from "effect"

const greet = Command.make(
  "greet",
  {
    name: Args.text({ name: "name" }),
    loud: Options.boolean("loud").pipe(Options.withAlias("l"))
  },
  ({ name, loud }) =>
    Effect.gen(function* () {
      const msg = `Hello, ${name}!`
      yield* Console.log(loud ? msg.toUpperCase() : msg)
    })
)

// Subcommands
const git = Command.make("git").pipe(
  Command.withSubcommands([
    Command.make("clone", { url: Args.text({ name: "url" }) },
      ({ url }) => Console.log(`Cloning ${url}`)),
    Command.make("commit", { message: Options.text("message").pipe(Options.withAlias("m")) },
      ({ message }) => Console.log(`Committing: ${message}`))
  ])
)
```

### Running the CLI

```typescript
import { Command } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, pipe } from "effect"

declare const myCommand: Command.Command<any, any, any, any>

const cli = Command.run(myCommand, { name: "my-cli", version: "1.0.0" })

pipe(
  cli(process.argv),
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
)
```

---

## 4. Command Execution (@effect/platform)

Execute system processes (distinct from CLI `Command`).

```typescript
import { Command, CommandExecutor } from "@effect/platform"
import { Effect, pipe } from "effect"

const program = Effect.gen(function* () {
  const executor = yield* CommandExecutor.CommandExecutor

  // Basic execution
  const exitCode = yield* Command.make("ls", "-la").pipe(
    Command.exitCode,
    Effect.provideService(CommandExecutor.CommandExecutor, executor)
  )

  const output = yield* Command.make("echo", "hello").pipe(
    Command.string,  // stdout as string
    Effect.provideService(CommandExecutor.CommandExecutor, executor)
  )

  const lines = yield* Command.make("ls").pipe(
    Command.lines,   // stdout as Array<string>
    Effect.provideService(CommandExecutor.CommandExecutor, executor)
  )

  // With options
  const withEnv = Command.make("node", "script.js").pipe(
    Command.env({ NODE_ENV: "production" }),
    Command.workingDirectory("/project"),
    Command.feed("stdin input")
  )

  // Piping
  const piped = pipe(
    Command.make("cat", "file.txt"),
    Command.pipeTo(Command.make("grep", "error")),
    Command.pipeTo(Command.make("wc", "-l"))
  )
})
```

---

## 5. Layer Provision

### Platform Contexts

```typescript
// Bun
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, pipe } from "effect"

declare const program: Effect.Effect<void>

pipe(program, Effect.provide(BunContext.layer), BunRuntime.runMain)

// Node
import { NodeContext, NodeRuntime } from "@effect/platform-node"
pipe(program, Effect.provide(NodeContext.layer), NodeRuntime.runMain)
```

Both provide: `FileSystem`, `Path`, `CommandExecutor`, `Terminal`, `WorkerManager`

### Testing with Mocks

```typescript
import { FileSystem } from "@effect/platform"
import { SystemError } from "@effect/platform/Error"
import { Effect, Layer } from "effect"

declare const program: Effect.Effect<void, never, FileSystem.FileSystem>

const FileSystemMock = Layer.succeed(
  FileSystem.FileSystem,
  FileSystem.FileSystem.of({
    readFileString: (path) =>
      path === "/test/file.txt"
        ? Effect.succeed("mocked content")
        : Effect.fail(new SystemError({ reason: "NotFound", module: "FileSystem", method: "readFileString" })),
    // ... other methods
  })
)

const test = program.pipe(Effect.provide(FileSystemMock))
```

### Layer Composition

```typescript
import { FileSystem, Path } from "@effect/platform"
import { BunRuntime } from "@effect/platform-bun"
import { Context, Effect, Layer, pipe } from "effect"

declare const program: Effect.Effect<void>

class MyService extends Context.Tag("MyService")<MyService, { doWork: () => Effect.Effect<void> }>() {}

const MyServiceLive = Layer.effect(
  MyService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    return MyService.of({
      doWork: () => fs.readFileString(path.join(import.meta.dir, "config.json"))
    })
  })
)

declare const BunContext: { layer: Layer.Layer<any> }

const AppLive = MyServiceLive.pipe(Layer.provide(BunContext.layer))
pipe(program, Effect.provide(AppLive), BunRuntime.runMain)
```

---

## 6. Complete Example

```bash
#!/usr/bin/env bun
```

```typescript
import { Args, Command, Options } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { FileSystem, Path } from "@effect/platform"
import { Console, Context, Effect, Layer, pipe } from "effect"

// Service
class Transformer extends Context.Tag("Transformer")<
  Transformer,
  { transform: (content: string, type: "uppercase" | "lowercase") => Effect.Effect<string> }
>() {}

const TransformerLive = Layer.succeed(Transformer, {
  transform: (content, type) =>
    type === "uppercase" ? Effect.succeed(content.toUpperCase()) : Effect.succeed(content.toLowerCase())
})

// CLI
const processCommand = Command.make(
  "process",
  {
    input: Args.file({ name: "input", exists: "yes" }),
    output: Options.file("output", { exists: "no" }).pipe(Options.withAlias("o")),
    transform: Options.choice("transform", ["uppercase", "lowercase"] as const).pipe(
      Options.withAlias("t"), Options.withDefault("uppercase" as const)
    ),
    verbose: Options.boolean("verbose").pipe(Options.withAlias("v"))
  },
  ({ input, output, transform, verbose }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const transformer = yield* Transformer

      const outputPath = output ?? `${path.basename(input, path.extname(input))}.out${path.extname(input)}`
      if (verbose) yield* Console.log(`Processing ${input} -> ${outputPath}`)

      const content = yield* fs.readFileString(input)
      const transformed = yield* transformer.transform(content, transform)
      yield* fs.writeFileString(outputPath, transformed)
      yield* Console.log(`Written to ${outputPath}`)
    })
)

// Run
const AppLive = TransformerLive.pipe(Layer.provide(BunContext.layer))
const cli = Command.run(processCommand, { name: "process", version: "1.0.0" })
pipe(cli(process.argv), Effect.provide(AppLive), BunRuntime.runMain)
```

---

## Quick Reference

| FileSystem | Description |
|------------|-------------|
| `readFile/readFileString` | Read bytes/string |
| `writeFile/writeFileString` | Write bytes/string |
| `exists/stat` | Check existence/metadata |
| `makeDirectory/readDirectory/remove` | Dir operations |
| `copy/copyFile/rename` | File operations |
| `makeTempDirectory/makeTempFile` | Temp resources |
| `stream/sink` | Streaming I/O |

| Path | Description |
|------|-------------|
| `join/resolve/relative` | Path manipulation |
| `dirname/basename/extname` | Path components |
| `normalize/isAbsolute` | Path normalization |
| `parse/format` | Object conversion |

| Args/Options | Type |
|--------------|------|
| `text/integer/float/boolean/date` | Primitives |
| `file/directory` | Path types |
| `choice` | Enum values |
| `keyValueMap` | Key-value pairs |
| `optional/repeated/withDefault` | Modifiers |

## Best Practices

1. **Always use abstractions** - Never import platform-specific modules
2. **Provide layers at entry point** - Use `BunContext.layer` or `NodeContext.layer`
3. **Use Effect.gen** - Cleaner than nested `pipe`
4. **Handle errors with catchTag** - Match on specific error reasons
5. **Stream large files** - Use `fs.stream` instead of `readFile`
6. **Test with mocks** - Mock FileSystem for unit tests
7. **Scope temp resources** - Use `makeTempFileScoped` for auto-cleanup
8. **Compose layers cleanly** - Build application layer from service layers and platform layer
