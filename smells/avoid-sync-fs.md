---
name: avoid-sync-fs
description: Avoid synchronous filesystem operations
glob: "**/*.{ts,tsx}"
pattern: (readFileSync|writeFileSync|mkdirSync|readdirSync|statSync|existsSync|copyFileSync|unlinkSync|rmdirSync|renameSync|appendFileSync)\s*\(
tag: no-sync-fs
severity: error
---

# Avoid Synchronous Filesystem Operations

Synchronous filesystem operations block the event loop, degrading application performance. They freeze the entire process until completion and can't be composed with Effect's concurrency primitives or interrupted.

**Instead:** Use Effect's `FileSystem` service which provides async operations that integrate with Effect's runtime for composition, retries, racing, and interruption.

```typescript
// ❌ WRONG
import { readFileSync, writeFileSync } from "fs"
const content = readFileSync("/path/file.txt", "utf-8")
writeFileSync("/path/out.txt", content)

// ✅ CORRECT
import { FileSystem } from "@effect/platform"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const content = yield* fs.readFileString("/path/file.txt")
  yield* fs.writeFileString("/path/out.txt", content)
})
```
