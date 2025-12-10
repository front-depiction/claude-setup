---
name: casting-awareness
description: Type assertions may indicate incorrect types
glob: "**/*.{ts,tsx}"
pattern: as\s+(?!const\b)\w+
tag: type-awareness
severity: info
---

# Type Assertion Awareness

Type assertions (`as T`) tell TypeScript "trust me, I know better." Sometimes this is correct—you genuinely have more information than the compiler. But often it signals that the types upstream could be improved.

**Before casting, check if it's even necessary.** Use `/type-at <file> <line> <col>` to inspect the actual type. Often the value is already the type you're casting to—the cast is redundant.

Consider whether:
- The value is already correctly typed (check with LSP!)
- The source type could be narrowed with generics
- A type guard would provide runtime safety
- The API returning the data could have better types
- Effect Schema could validate external data

This is informational only—casting isn't always wrong, just worth a second look.
