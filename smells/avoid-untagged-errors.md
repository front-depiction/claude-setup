---
name: avoid-untagged-errors
description: Avoid instanceof Error and new Error - use Data.TaggedError for typed errors
glob: "**/*.{ts,tsx}"
pattern: "(instanceof\\s+Error|new\\s+Error\\s*\\()"
tag: avoid-untagged-errors
severity: warning
---

# Avoid `instanceof Error` and `new Error` in Effect Code

Using `instanceof Error` or `new Error()` indicates untyped error handling. Effect code should use `Data.TaggedError` for type-safe, discriminated errors that flow through the error channel.

**Problems with untagged errors:**
- `instanceof Error` checks are a code smell - errors should be discriminated by `_tag`
- `new Error()` creates opaque errors without type discrimination
- Can't exhaustively pattern match on error types
- Loses the benefits of Effect's typed error channel
- Often indicates try-catch usage or Promise-style error handling

**Instead use:**
- `Data.TaggedError` - define discriminated error types
- `catchTag` / `catchTags` - handle specific error types
- `Match.tag` or `_tag` checks for error discrimination
- `Effect.fail(new MyTaggedError(...))` - fail with typed errors

**Example transformation:**
```typescript
// Bad: untagged error handling
if (error instanceof Error) {
  console.log(error.message)
}
throw new Error("Something went wrong")

// Good: tagged error handling
class MyError extends Data.TaggedError("MyError")<{ message: string }> {}

// Creating errors
Effect.fail(new MyError({ message: "Something went wrong" }))

// Handling errors by tag
pipe(
  myEffect,
  Effect.catchTag("MyError", (e) => Effect.succeed(e.message))
)
```
