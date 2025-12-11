---
name: avoid-expect-in-if
description: Avoid nesting expect() calls inside if blocks in tests
glob: "**/*.{test,spec}.{ts,tsx}"
pattern: if\s*\([^)]*\)\s*\{[^}]*expect\(
tag: use-assert-to-narrow
severity: warning
---

# Avoid `expect()` Inside `if` Blocks

Nesting `expect()` calls inside `if` blocks is a code smell indicating the test needs type narrowing. When you write `if (value) { expect(value.prop)... }`, the test silently passes if the condition is false, hiding failures.

**Instead:** Use `assert` or type guard assertions to narrow types. This ensures the test fails fast if the expected condition isn't met, rather than silently skipping assertions.

```typescript
// Bad - silently skips if value is undefined
if (result.value) {
  expect(result.value.name).toBe("test")
}

// Good - fails immediately if value is undefined
assert(result.value, "Expected value to be defined")
expect(result.value.name).toBe("test")

// Also good - use expect with toBeDefiend first
expect(result.value).toBeDefined()
assert(result.value) // narrow for TypeScript
expect(result.value.name).toBe("test")
```
