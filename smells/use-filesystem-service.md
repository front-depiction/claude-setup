---
name: use-filesystem-service
description: Use FileSystem service instead of direct Node.js fs imports
glob: "**/*.{ts,tsx}"
pattern: (import\s+.*\s+from\s+['"]node:fs['"]|import\s+.*\s+from\s+['"]fs['"]|require\(['"]node:fs['"]\)|require\(['"]fs['"]\))
tag: use-effect-filesystem
severity: error
---

# Use FileSystem Service Instead of Direct `fs` Imports

Direct imports of Node.js `fs` or `node:fs` modules break cross-platform compatibility and prevent testability. These platform-specific imports couple your code to Node.js, making it impossible to run on other platforms (Bun, browser) or mock filesystem operations in tests.

**Instead:** Use `@effect/platform`'s `FileSystem` service which provides a platform-agnostic abstraction. Provide the appropriate platform layer (`BunContext.layer` or `NodeContext.layer`) at your application entry point.

```typescript
// ❌ WRONG
import * as fs from "node:fs"
import { readFileSync } from "fs"

// ✅ CORRECT
import { FileSystem } from "@effect/platform"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const content = yield* fs.readFileString("/path/to/file.txt")
  return content
})
```
