---
name: use-temp-file-scoped
description: Use makeTempFileScoped/makeTempDirectoryScoped for automatic cleanup
glob: "**/*.{ts,tsx}"
pattern: \.(makeTempFile|makeTempDirectory)\s*\(
tag: use-scoped-temp
severity: info
---

# Use Scoped Temp Files for Automatic Cleanup

Using `makeTempFile` or `makeTempDirectory` without the `Scoped` variant requires manual cleanup and can leak resources if errors occur. This leads to disk space issues and file handle leaks.

**Instead:** Use `makeTempFileScoped` or `makeTempDirectoryScoped` which automatically clean up when the scope ends, even on errors.

```typescript
// ⚠️ RISKY - manual cleanup required
const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const tmpFile = yield* fs.makeTempFile()
  // use tmpFile
  yield* fs.remove(tmpFile)  // might not execute on error
})

// ✅ SAFE - automatic cleanup
const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const tmpFile = yield* fs.makeTempFileScoped()
  // use tmpFile - automatically cleaned up when scope ends
}).pipe(Effect.scoped)
```
