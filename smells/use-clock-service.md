---
name: use-clock-service
description: Use Effect DateTime instead of JS Date
glob: "**/*.{ts,tsx}"
pattern: (new Date\(|Date\.\w+\()
tag: use-effect-clock
severity: warning
---

# Use Effect DateTime Instead of JS Date

Direct use of JavaScript's `Date` object (`new Date()`, `Date.now()`, `Date.parse()`, etc.) is non-deterministic and makes tests flaky or impossible to write correctly. Time-based logic becomes unpredictable in tests and can't be controlled for reproducible results.

**Instead:** Use Effect's `DateTime` module for all date/time operations. For current time, use `DateTime.now` or `Clock.currentTimeMillis`. This enables controlled time in tests via `TestClock` and proper integration with Effect's scheduling features.
