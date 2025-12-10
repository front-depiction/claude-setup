---
name: avoid-any
description: Avoid using 'as any' or 'as unknown as' type assertions
glob: "**/*.{ts,tsx}"
pattern: as\s+(any|unknown\s+as)
tag: do-not-use-any
severity: warning
---

# Avoid `as any` and `as unknown as` Type Assertions

Using `as any` defeats TypeScript's type safety and eliminates the benefits of static typing. It bypasses type checking entirely, making refactoring dangerous and masking bugs that should be caught at compile time rather than runtime.

The `as unknown as T` pattern is equally problematic—it's just `as any` with extra steps. Casting through `unknown` still erases type information and bypasses the type checker.

**Instead:** Use `unknown` with type guards, define specific types or interfaces, use generics to preserve type information, or use Effect Schema for runtime validation of external data.
