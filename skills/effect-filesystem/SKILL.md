---
name: effect-filesystem
description: Use @effect/platform's FileSystem module for cross-platform file I/O in Effect code. Use when reading/writing files, streaming, watching, or any filesystem operation in an Effect context.
---

## What this is

`FileSystem` is @effect/platform's abstraction over Node/Bun/Browser filesystem capabilities. It lives in `.context/effect/packages/platform/`.

## Mandatory reading

- Package source: `.context/effect/packages/platform/src/FileSystem.ts` — interface + available operations
- Real usage patterns: `.context/effect/packages/platform/test/FileSystem.test.ts` — grep for `FileSystem.FileSystem`, `fs.readFile`, `fs.writeFile`, `fs.stream` to find idiomatic usage
- Node-specific impl: `.context/effect/packages/platform-node/src/NodeFileSystem.ts` for layer wiring in Node contexts

## Reading order

1. Read `FileSystem.ts` interface to know what operations are available
2. Grep the test for the operation you need:
   `grep -n "readFile\|writeFile\|makeDirectory\|remove\|stream" .context/effect/packages/platform/test/FileSystem.test.ts`
3. Copy + adapt

## When to use this skill

Only when writing code that uses `FileSystem.FileSystem` from `@effect/platform`. For layer provision patterns, see `/skills platform-abstraction`.
