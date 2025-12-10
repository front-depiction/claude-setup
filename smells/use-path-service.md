---
name: use-path-service
description: Use Path service instead of direct Node.js path imports
glob: "**/*.{ts,tsx}"
pattern: (import\s+.*\s+from\s+['"]node:path['"]|import\s+.*\s+from\s+['"]path['"])
tag: use-effect-path
severity: warning
---

# Use Path Service Instead of Direct `path` Imports

Direct imports of Node.js `path` module break cross-platform compatibility. Path separators and absolute path formats differ across platforms (Windows vs Unix).

**Instead:** Use `@effect/platform`'s `Path` service which provides platform-agnostic path operations. The platform layer automatically provides the correct implementation for your runtime.

```typescript
// ❌ WRONG
import * as path from "node:path"
const filePath = path.join(dir, filename)

// ✅ CORRECT
import { Path } from "@effect/platform"

const program = Effect.gen(function* () {
  const path = yield* Path.Path
  const filePath = path.join(dir, filename)
  return filePath
})
```
