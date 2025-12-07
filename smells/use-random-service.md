---
name: use-random-service
description: Use Random service instead of Math.random()
glob: "**/*.{ts,tsx}"
pattern: Math\.random\(\)
tag: use-effect-random
severity: warning
---

# Use Random Service Instead of `Math.random()`

Direct calls to `Math.random()` are non-deterministic and make tests impossible to reproduce. You can't control random values in tests, making it impossible to test edge cases or verify random-dependent logic reliably.

**Instead:** Use Effect's `Random` service (`Random.next`, `Random.nextIntBetween`, `Random.shuffle`, etc.). This enables deterministic testing with `TestRandom` where you can seed values or feed specific sequences for edge case testing.
