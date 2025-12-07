---
name: avoid-direct-json
description: Consider using Schema.parseJson instead of direct JSON methods
glob: "**/*.{ts,tsx}"
pattern: JSON\.(parse|stringify)\(
tag: prefer-schema-json
severity: log
---

# Consider Schema.parseJson Instead of Direct JSON Methods

Direct usage of `JSON.parse()` and `JSON.stringify()` bypasses type safety and validation. These methods:
- Return `any` type (`JSON.parse`) losing all type information
- Can throw runtime errors on invalid input
- Provide no validation of data structure or content

**Instead:** Consider using Effect's `Schema.parseJson` which provides:
- Type-safe encoding/decoding with a single bidirectional schema
- Runtime validation with detailed error messages
- Automatic type inference from schema definitions

```typescript
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
})

// Parsing JSON string -> typed value (decode)
const parseUser = Schema.decodeSync(Schema.parseJson(User))
const user = parseUser('{"id": 1, "name": "Alice"}')

// Stringifying typed value -> JSON string (encode)
const stringifyUser = Schema.encodeSync(Schema.parseJson(User))
const json = stringifyUser({ id: 1, name: "Alice" })
```

`Schema.parseJson` supports options for custom reviver/replacer and formatting:
```typescript
Schema.parseJson(User, { space: 2 }) // Pretty-print with 2-space indent
```

**Note:** Direct JSON usage may be acceptable for simple logging, debugging, or low-level interop where Schema overhead isn't justified. Use judgment based on context.
