---
name: effect-concurrency-testing
description: Test Effect concurrency primitives (Fibers, Deferred, Latch, PubSub, SubscriptionRef, Stream) using @effect/vitest. Use when writing tests that exercise concurrent effects, fiber coordination, or event-driven Effect systems.
---

## What this is

Effect's concurrency primitives live in `effect` (the core package) and testing them deterministically requires `@effect/vitest`'s TestClock and Fiber utilities. Tests live in `.context/effect/packages/effect/test/`.

## Mandatory reading

- Testing utilities: `.context/effect/packages/vitest/` — any README or ai-context there
- Real usage patterns (the authoritative source):
  - `.context/effect/packages/effect/test/Fiber.test.ts`
  - `.context/effect/packages/effect/test/Deferred.test.ts`
  - `.context/effect/packages/effect/test/PubSub.test.ts`
  - `.context/effect/packages/effect/test/Latch.test.ts`
  - `.context/effect/packages/effect/test/Queue.test.ts`
  - `.context/effect/packages/effect/test/Stream.test.ts`
  - `.context/effect/packages/effect/test/SubscriptionRef.test.ts`

Grep pattern for quick discovery:
`grep -rn "TestClock\|Fiber\.fork\|Deferred\.make\|Latch\.make" .context/effect/packages/effect/test/`

## Reading order

1. Grep the Effect package tests for the primitive you need to test
2. Copy the idiom (fork, wait, assert, clean up)
3. Adapt to your scenario

## When to use this skill

Only when writing tests that involve concurrent Effect primitives. For general Effect testing patterns, see `/skills effect-testing`.
