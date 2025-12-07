---
name: avoid-any
description: Avoid using 'as any' type assertions
glob: "**/*.{ts,tsx}"
pattern: as\s+any
tag: do-not-use-any
severity: warning
---

# Avoid `as any` Type Assertions

Using `as any` defeats TypeScript's type safety and eliminates the benefits of static typing. It bypasses type checking entirely, making refactoring dangerous and masking bugs that should be caught at compile time rather than runtime.

**Instead:** Use `unknown` with type guards, define specific types or interfaces, use generics to preserve type information, or use Effect Schema for runtime validation of external data.
