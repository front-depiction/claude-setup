---
name: avoid-try-catch
description: Avoid try-catch blocks in Effect code - use Effect.try or typed errors
glob: "**/*.{ts,tsx}"
pattern: "try\\s*\\{"
tag: avoid-try-catch
severity: warning
---

# Avoid `try { ... } catch` in Effect Code

In Effect-based code, `try-catch` blocks break the error channel and lose type safety. Errors caught this way become opaque and untracked in the type system.

**Problems with try-catch:**
- Errors are not reflected in the Effect's error type parameter
- No compile-time guarantee that errors are handled
- Breaks composition - caught errors can't flow through Effect pipelines
- Encourages returning `{ success: boolean }` result types instead of using Effect's error channel

**Instead use:**
- `Effect.try(() => ...)` - wraps sync code that might throw
- `Effect.tryPromise(() => ...)` - wraps async code that might throw
- `Data.TaggedError` - define typed errors for your domain
- `Effect.fail(new MyError(...))` - fail with typed errors
- `Option.fromNullable` - for nullable values instead of try-catch around access

**Example transformation:**
```typescript
// Bad: try-catch with result object
function getData(): { success: boolean; data?: string; error?: string } {
  try {
    const result = riskyOperation()
    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// Good: Effect with typed error
class DataError extends Data.TaggedError("DataError")<{ message: string }> {}

const getData = Effect.try({
  try: () => riskyOperation(),
  catch: (e) => new DataError({ message: String(e) })
})
```
