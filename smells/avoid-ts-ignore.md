---
name: avoid-ts-ignore
description: Avoid using @ts-ignore or @ts-expect-error to silence type errors
glob: "**/*.{ts,tsx}"
pattern: @ts-(ignore|expect-error)
tag: do-not-silence-types
severity: warning
---

# Avoid `@ts-ignore` and `@ts-expect-error`

Suppressing TypeScript errors masks real type issues instead of solving them. These comments disable type checking for the next line, hiding bugs that will surface at runtime and breaking refactoring safety.

**Instead:** Fix the root cause by addressing the underlying type issue, use proper type guards or Schema validation for unknown types, improve type definitions for third-party libraries, or use explicit type assertions with `as` when truly necessary.
