---
name: stream-large-files
description: Consider streaming large files instead of reading into memory
glob: "**/*.{ts,tsx}"
pattern: fs\.(readFile|readFileString)\s*\(
tag: consider-streaming
severity: info
---

# Consider Streaming Large Files

Reading entire files into memory with `readFile` or `readFileString` can cause out-of-memory errors for large files. Loading gigabyte-sized files will exhaust available memory.

**Instead:** For large files or line-by-line processing, use `fs.stream()` which returns a `Stream<Uint8Array>` for incremental processing.

```typescript
// ⚠️ RISKY for large files
const content = yield* fs.readFileString("/large-file.txt")

// ✅ BETTER for large files
import { Stream } from "effect"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const stream = fs.stream("/large-file.txt", { chunkSize: 64 * 1024 })

  yield* stream.pipe(
    Stream.decodeText("utf-8"),
    Stream.splitLines,
    Stream.map(processLine),
    Stream.runDrain
  )
})
```
