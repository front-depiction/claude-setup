---
name: use-console-service
description: Use Effect Console or Effect.log instead of console
glob: "**/*.{ts,tsx}"
pattern: console\.(log|error|warn|info|debug|trace)\(
tag: use-effect-console
severity: warning
---

# Use Effect Console Instead of console.*

Direct use of `console.log`, `console.error`, etc. in Effect code breaks the effectful paradigm. Wrapping console calls in `Effect.sync` is especially egregious - it's effectful ceremony with none of the benefits.

**Bad:**
```typescript
Effect.tapError((error) =>
  Effect.sync(() => {
    console.error("Chat error:", error)
  })
)
```

**Good:**
```typescript
import * as Console from "effect/Console"

Effect.tapError((error) => Console.error("Chat error:", error))
```

**Also Good:**
```typescript
Effect.tapError(Effect.logError)
```

**Why this matters:**
- `Console` integrates with Effect's logging infrastructure
- `Effect.log*` adds structured context, spans, and log levels
- Console service can be mocked in tests
- Consistent with Effect's philosophy of explicit effects
