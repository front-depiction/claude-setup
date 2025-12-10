---
name: yield-in-for-loop
description: Use Effect.forEach or STM.forEach instead of yield* in for loops
glob: "**/*.{ts,tsx}"
pattern: for\s*\([^)]*\)\s*\{[^}]*yield\s*\*
tag: use-foreach
severity: warning
---

# Use `Effect.forEach` Instead of For Loops

Using `yield*` inside a `for` loop is imperative. Use `Effect.forEach` for declarative iteration with composability benefits (easy parallelization, uniform error handling).

```typescript
// Bad - imperative for loop
for (const item of items) {
  yield* processItem(item)
}

// Good - declarative
yield* Effect.forEach(items, processItem)

// Good - parallel execution
yield* Effect.forEach(items, processItem, { concurrency: "unbounded" })
```

**Handling conditionals:**

```typescript
// Bad - continue for conditional skip
for (const id of ids) {
  if (alreadyProcessed.has(id)) continue
  yield* process(id)
}

// Good - filter first, or conditional in callback
yield* Effect.forEach(
  ids.filter((id) => !alreadyProcessed.has(id)),
  process
)
// Or:
yield* Effect.forEach(ids, (id) =>
  alreadyProcessed.has(id) ? Effect.void : process(id)
)
```

**When the operation is effectful:**

```typescript
// Bad - effectful validation in for loop
for (const user of users) {
  const isActive = yield* checkUserStatus(user.id)
  if (!isActive) continue
  yield* sendNotification(user)
}

// Good - Effect.filter for effectful predicate, then forEach
const activeUsers = yield* Effect.filter(users, (user) =>
  checkUserStatus(user.id)
)
yield* Effect.forEach(activeUsers, sendNotification)
```
