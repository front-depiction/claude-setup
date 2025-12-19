---
name: use-temp-file-scoped
description: Use makeTempFileScoped/makeTempDirectoryScoped instead of os.tmpdir() or non-scoped variants
glob: "**/*.{ts,tsx}"
pattern: (import\s+.*\s+from\s+['"]os['"]|require\(['"]os['"]\)|os\.tmpdir\(\)|\.(makeTempFile|makeTempDirectory)\s*\()
tag: use-scoped-temp
severity: warning
---

# Use Scoped Temp Files for Automatic Cleanup

## Problem: Direct `os.tmpdir()` Usage

Using Node.js's `os.tmpdir()` or importing the `os` module breaks cross-platform compatibility and requires manual cleanup. This approach:

- **No automatic cleanup** - You must manually track and remove temp files/directories
- **Not cross-platform** - Couples code to Node.js, preventing use with Bun or other runtimes
- **Manual resource management** - Easy to leak resources on errors or early returns
- **No Effect integration** - Can't compose with Effect's resource management

```typescript
// ❌ WRONG - breaks cross-platform compatibility
import os from "os"
import path from "path"
import fs from "fs/promises"

const tmpDir = os.tmpdir()
const tmpFile = path.join(tmpDir, "myfile.txt")
await fs.writeFile(tmpFile, "data")
// Manual cleanup required - might not happen on error!
await fs.unlink(tmpFile)
```

## Problem: Non-Scoped FileSystem Methods

Using `makeTempFile` or `makeTempDirectory` without the `Scoped` variant requires manual cleanup and can leak resources if errors occur. This leads to disk space issues and file handle leaks.

```typescript
// ⚠️ RISKY - manual cleanup required
const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const tmpFile = yield* fs.makeTempFile()
  // use tmpFile
  yield* fs.remove(tmpFile)  // might not execute on error
})
```

## Solution: Use `makeTempFileScoped` or `makeTempDirectoryScoped`

**Instead:** Use Effect's `FileSystem.makeTempFileScoped` or `FileSystem.makeTempDirectoryScoped` which:

- **Automatic cleanup** - Resources cleaned up when scope ends, even on errors
- **Cross-platform** - Works with any platform via `@effect/platform` abstractions
- **Effect resource management** - Integrates with Effect's scoped resource system
- **Testable** - Can be mocked for testing

```typescript
// ✅ CORRECT - cross-platform with automatic cleanup
import { FileSystem } from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem

  // Automatically cleaned up when scope ends
  const tmpFile = yield* fs.makeTempFileScoped({ prefix: "myapp-" })
  yield* fs.writeFileString(tmpFile, "data")
  // use tmpFile - automatically removed when scope ends
}).pipe(Effect.scoped)

// For directories
const programDir = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "myapp-" })
  const filePath = path.join(tmpDir, "file.txt")
  yield* fs.writeFileString(filePath, "data")
  // entire directory automatically removed when scope ends
}).pipe(Effect.scoped)
```

## Provide Platform Layer at Entry Point

```typescript
import { BunContext, BunRuntime } from "@effect/platform-bun"
// or: import { NodeContext, NodeRuntime } from "@effect/platform-node"

pipe(
  program,
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
)
```
