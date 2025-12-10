---
name: avoid-fs-promises
description: Wrap fs/promises with Effect instead of using directly
glob: "**/*.{ts,tsx}"
pattern: (import\s+.*\s+from\s+['"]node:fs/promises['"]|import\s+.*\s+from\s+['"]fs/promises['"])
tag: wrap-fs-promises
severity: warning
---

# Avoid Direct `fs/promises` Usage

While `fs/promises` is async, using it directly loses Effect's benefits: typed errors, composability, dependency injection, resource management, and testability. Operations throw untyped exceptions and can't be composed with Effect's primitives.

**Instead:** Use `@effect/platform`'s `FileSystem` service which wraps async operations in Effect, providing typed errors (`SystemError` with reasons like `NotFound`, `PermissionDenied`), proper resource management, and full composability.

```typescript
// ❌ WRONG
import { readFile } from "node:fs/promises"
const content = await readFile("/path/file.txt", "utf-8")

// ✅ CORRECT
import { FileSystem } from "@effect/platform"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const content = yield* fs.readFileString("/path/file.txt")
  return content
})
```
