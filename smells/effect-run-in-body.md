---
name: effect-run-in-body
description: Effect.runSync/runPromise should only be at entry points
glob: "**/*.{ts,tsx}"
pattern: Effect\.run(Sync|Promise)
tag: effect-run-in-body
severity: warning
---

# Effect.runSync/runPromise Only at Entry Points

Running effects in the middle of application logic breaks composition and prevents you from transforming, retrying, or racing effects. It converts declarative Effect programs back into imperative side effects, defeating the entire purpose of Effect.

**Instead:** Compose effects using `Effect.gen` and `yield*` throughout your application. Only run effects at entry points: main functions, API handlers, event handlers, or test runners. Keep your logic as composable Effect values until the application boundary.
