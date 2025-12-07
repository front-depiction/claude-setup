---
name: use-clock-service
description: Use Clock service instead of Date.now()
glob: "**/*.{ts,tsx}"
pattern: Date\.now\(\)
tag: use-effect-clock
severity: warning
---

# Use Clock Service Instead of `Date.now()`

Direct calls to `Date.now()` are non-deterministic and make tests flaky or impossible to write correctly. Time-based logic becomes unpredictable in tests and can't be controlled for reproducible results.

**Instead:** Use Effect's `Clock` service (`Clock.currentTimeMillis`, `Clock.currentTimeNanos`) or `DateTime.now` for date operations. This enables controlled time in tests via `TestClock` and proper integration with Effect's scheduling features.
