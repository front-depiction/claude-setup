---
name: avoid-direct-tag-checks
description: Avoid direct _tag property checks; use exported refinements/predicates
glob: "**/*.{ts,tsx}"
pattern: \._tag\s*===\s*["']
tag: use-type-predicates
severity: warning
---

# Avoid Direct `_tag` Property Checks

Checking `._tag === "SomeVariant"` directly is a code smell. Tagged types should export refinements and predicates that:

1. Provide better type narrowing
2. Centralize the discrimination logic
3. Make refactoring safer (rename the tag, update one place)
4. Enable better composition with Effect's `Match` and `$is`/`$match` utilities

**Bad:**
```typescript
if (event._tag === "FactRecorded") {
  // TypeScript may not narrow correctly
}
```

**Good:**
```typescript
// Module exports predicates
export const isFactRecorded = (e: SessionEvent): e is FactRecorded =>
  e._tag === "FactRecorded"

// Or use Data.TaggedEnum's $is
const { $is } = Data.taggedEnum<SessionEvent>()

if ($is("FactRecorded")(event)) {
  // Properly narrowed
}
```

**Best:** Use pattern matching instead of conditionals:
```typescript
const { $match } = Data.taggedEnum<SessionEvent>()

pipe(
  event,
  $match({
    FactRecorded: (e) => handleFact(e),
    QuestionAsked: (e) => handleQuestion(e),
  })
)
```
