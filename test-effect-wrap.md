# Effect Wrap Testing Guide

## Overview

The updated `effect-wrap.ts` now includes:

1. **Proper @effect/cli usage** - Uses `Command.make`, `Args.repeated`, and `CliApp.make`
2. **InputTransformer service** - Intercepts stdin and transforms text before passing to Claude

## Key Implementation Details

### 1. CLI Module Usage

```typescript
// Define command with variadic arguments using Args.repeated
const claudeCommand = CliCommand.make(
  "claude-wrapper",
  {
    args: pipe(
      Args.text({ name: "argument" }),
      Args.withDescription("Arguments to pass to Claude Code"),
      Args.repeated  // Captures 0 or more arguments
    )
  },
  ({ args }) => Effect.gen(...)
)

// Create CLI application
const cli = CliApp.make({
  name: "Claude Code Wrapper",
  version: "1.0.0",
  command: claudeCommand
})

// Run with process.argv
CliApp.run(cli, process.argv.slice(2), () => Effect.void)
```

### 2. InputTransformer Service

```typescript
// Service definition
export class InputTransformer extends Context.Tag("InputTransformer")<
  InputTransformer,
  {
    readonly transform: (
      input: Stream.Stream<Uint8Array>
    ) => Stream.Stream<Uint8Array>
  }
>() {}

// Service implementation as a Layer
export const InputTransformerLive = Layer.succeed(
  InputTransformer,
  InputTransformer.of({
    transform: (input) =>
      pipe(
        input,
        Stream.decodeText("utf-8"),      // Bytes → String
        Stream.map((text) =>              // Transform text
          text.replace(/hello/gi, "hello from effect")
        ),
        Stream.encodeText                 // String → Bytes
      )
  })
)
```

### 3. Stdin Interception

```typescript
// Create stdin stream from Bun.stdin
const stdinStream = Stream.fromReadableStream(
  () => Bun.stdin.stream(),
  (error) => error
)

// Transform using the service
const transformedStdin = transformer.transform(stdinStream)

// Pass to Claude subprocess
pipe(
  command,
  PlatformCommand.stdin(transformedStdin),  // Transformed stdin
  PlatformCommand.stdout("inherit"),
  PlatformCommand.stderr("inherit"),
  executor.start
)
```

## Testing

### Test 1: Verify CLI Argument Forwarding

```bash
# Should show Claude's help
bun run effect-wrap.ts --help

# Should pass the message to Claude
bun run effect-wrap.ts "Write a hello world function"
```

### Test 2: Verify Stdin Transformation

```bash
# Type "hello" in the interactive session
# Claude should receive "hello from effect"
bun run effect-wrap.ts

# Or pipe stdin
echo "hello world" | bun run effect-wrap.ts "Process this input"
```

### Test 3: Case-Insensitive Replacement

```bash
# All variants should be transformed:
# "hello" → "hello from effect"
# "Hello" → "Hello from effect"
# "HELLO" → "HELLO from effect"
echo "Hello WORLD" | bun run effect-wrap.ts "Test case insensitive"
```

## Architecture Benefits

### Service Pattern
- **Separation of concerns**: Transformation logic isolated in a service
- **Testability**: Can provide mock implementations
- **Composability**: Easy to add more transformations

### Layer Pattern
- **Dependency injection**: Service provided via Layer
- **No requirements leak**: Transform function has no Effect requirements
- **Easy to swap**: Can provide different implementations for testing

### Stream Operations
- **Efficient**: Processes data as it arrives, no buffering
- **Composable**: Can chain multiple transformations
- **Type-safe**: Compile-time guarantees about data flow

## Implementation Notes

### Why Args.repeated?

The `Args.repeated` combinator allows the CLI to accept 0 or more arguments, which is perfect for forwarding all arguments to the Claude subprocess. It's equivalent to `...args` in TypeScript but handled by the CLI parser.

### Why Stream.decodeText/encodeText?

stdin/stdout work with `Uint8Array` (bytes), but text replacement needs strings. The encode/decode operations convert between the two while maintaining proper UTF-8 encoding.

### Why Context.Tag?

`Context.Tag` creates a proper Effect service that:
- Has a unique identifier
- Can be provided via Layers
- Supports dependency injection
- Maintains type safety

### Why Layer.succeed?

`Layer.succeed` creates a layer without requirements (pure construction). Since our transformer has no dependencies, this is the simplest layer constructor. Alternative constructors:
- `Layer.effect` - for effectful construction
- `Layer.scoped` - for resource management

## Possible Extensions

### Multiple Transformations

```typescript
export const InputTransformerLive = Layer.succeed(
  InputTransformer,
  InputTransformer.of({
    transform: (input) =>
      pipe(
        input,
        Stream.decodeText("utf-8"),
        Stream.map((text) =>
          text
            .replace(/hello/gi, "hello from effect")
            .replace(/world/gi, "WORLD")
            .trim()
        ),
        Stream.encodeText
      )
  })
)
```

### Logging Transformation

```typescript
export const InputTransformerWithLogging = Layer.effect(
  InputTransformer,
  Effect.gen(function* () {
    const logger = yield* Logger

    return InputTransformer.of({
      transform: (input) =>
        pipe(
          input,
          Stream.decodeText("utf-8"),
          Stream.tap((text) => logger.log(`Received: ${text}`)),
          Stream.map((text) => text.replace(/hello/gi, "hello from effect")),
          Stream.tap((text) => logger.log(`Transformed: ${text}`)),
          Stream.encodeText
        )
    })
  })
)
```

### Configuration-Based Replacement

```typescript
export const makeInputTransformer = (config: {
  readonly replacements: ReadonlyArray<[RegExp, string]>
}) =>
  Layer.succeed(
    InputTransformer,
    InputTransformer.of({
      transform: (input) =>
        pipe(
          input,
          Stream.decodeText("utf-8"),
          Stream.map((text) =>
            config.replacements.reduce(
              (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
              text
            )
          ),
          Stream.encodeText
        )
    })
  )

// Usage
const CustomTransformer = makeInputTransformer({
  replacements: [
    [/hello/gi, "hello from effect"],
    [/goodbye/gi, "farewell from effect"]
  ]
})
```
