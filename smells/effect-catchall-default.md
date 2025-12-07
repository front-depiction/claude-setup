---
name: effect-catchall-default
description: Avoid Effect.catchAll returning defaults - often hides bugs
glob: "**/*.{ts,tsx}"
pattern: Effect\.catchAll\([^)]*=>\s*(Effect\.)?(succeed|sync)\(
tag: avoid-catchall-default
severity: warning
---

# Avoid Effect.catchAll with Default Values

Catching all errors and returning a default value hides bugs, loses error context, and makes debugging impossible. Real errors are silently swallowed and masked as "success" with no observability into what went wrong or why.

**Instead:** Use `catchTag` or `catchTags` to handle specific expected errors with logging. Use `Option` for expected absence rather than error handling. Use `Either` to make success/failure explicit. Let unexpected errors propagate - they're bugs that should fail fast, not be hidden.
