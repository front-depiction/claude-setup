---
name: effect-cli
description: Build CLI apps using @effect/cli. Use when defining commands, args, options, subcommand trees, or wiring a CLI entrypoint with Effect.
---

## What this is

`@effect/cli` is Effect's typed CLI framework. It lives in `.context/effect/packages/cli/`.

## Mandatory reading

Before writing or reviewing code using `@effect/cli`, read:

- The package source: `.context/effect/packages/cli/src/` — `Command.ts`, `Args.ts`, `Options.ts` are the three main surfaces
- Real usage patterns: `.context/effect/packages/cli/test/` — grep for `Command.make`, `Command.run`, `Options.`, `Args.` to find idiomatic constructions
- Example CLI apps: any `examples/` directory under the cli package

## Reading order

1. Skim `.context/effect/packages/cli/` for a README or ai-context
2. Grep tests for the specific construction you need:
   `grep -rn "Command.make\|Command.run\|Options\.\|Args\." .context/effect/packages/cli/test/`
3. Copy the idiom from the test, adapt to your case

## When to use this skill

Only when writing code that imports `@effect/cli`.
