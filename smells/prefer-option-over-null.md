---
name: prefer-option-over-null
description: Consider using Option instead of union with null
glob: "**/*.{ts,tsx}"
pattern: \|\s*null(?!\s*\|)|null\s*\|
tag: effect-patterns
severity: info
---

# Consider `Option` Instead of `| null`

Union types with `null` work, but `Option<T>` from Effect provides a richer API for handling optional values. This is a low-priority signal, not an error.

**Why Option?**

- Chainable operations: `Option.map`, `Option.flatMap`, `Option.filter`
- Explicit handling: forces consideration of the "none" case
- Composable: works seamlessly with Effect pipelines
- No null checks scattered through code

**When `| null` is fine:**

- External API boundaries (JSON, DOM, third-party libs)
- Simple cases where Option would be overkill
- Performance-critical paths where the extra allocation matters

**Instead of:**
```ts
function find(id: string): User | null
```

**Consider:**
```ts
import { Option } from "effect"

function find(id: string): Option.Option<User>
```
