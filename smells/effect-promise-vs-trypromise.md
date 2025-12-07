---
name: effect-promise-vs-trypromise
description: Use Effect.tryPromise instead of Effect.promise for error handling
glob: "**/*.{ts,tsx}"
pattern: yield\*\s+Effect\.promise
tag: use-effect-trypromise
severity: warning
---

# Use Effect.tryPromise Instead of Effect.promise

`Effect.promise` only handles success - rejected promises become untyped defects that bypass normal error handling. Defects can't be caught with `catchTag` or `catchAll`, making error recovery impossible and tests fail catastrophically.

**Instead:** Use `Effect.tryPromise` for promises that can reject (99% of cases). This puts errors in the type signature as `Effect.Effect<A, E>` where they can be properly handled, recovered from, and tested. Define custom error classes extending `Data.TaggedError` for precise error handling.
