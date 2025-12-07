---
name: avoid-non-null-assertion
description: Avoid using ! non-null assertion operator
glob: "**/*.{ts,tsx}"
pattern: \!\s*[;\.\[\(]
tag: do-not-assert-non-null
severity: warning
---

# Avoid Non-Null Assertion Operator `!`

The `!` operator tells TypeScript "trust me, this value is not null/undefined" without runtime checks. If the assumption proves false, your app crashes with "Cannot read property of undefined" instead of being caught at compile time.

**Instead:** Use optional chaining (`?.`) with nullish coalescing (`??`), explicit null checks, Effect's `Option` type for optional values, Schema validation for external data, or type guards to prove to TypeScript that a value exists.
