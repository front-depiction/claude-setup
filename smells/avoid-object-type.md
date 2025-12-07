---
name: avoid-object-type
description: Avoid using Object or {} as types
glob: "**/*.{ts,tsx}"
pattern: :\s*(Object|{})\s*[,;\)\]\|&]
tag: do-not-use-object-type
severity: warning
---

# Avoid `Object` and `{}` as Types

Using `Object` or `{}` as types provides almost no type safety. They accept nearly any value except null/undefined, making them barely better than `any`. They don't describe data structure, provide poor IDE support, and make refactoring dangerous.

**Instead:** Define explicit interfaces or type aliases for object shapes, use `Record<K, V>` for dictionaries with arbitrary keys, use Effect Schema for runtime validation of external data, use `unknown` for truly unknown types, or use generics for flexible but type-safe functions.
