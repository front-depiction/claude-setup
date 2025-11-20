# Pattern Matching Skill

Implement type-safe pattern matching using Effect's tagged enums for discriminated unions and ADTs.

## Core Pattern: Tagged Enum Definition

Use `Data.TaggedEnum` for creating discriminated unions with exhaustive pattern matching:

```typescript
import { Data } from "effect"

// Define the tagged enum type
export type ParamMatcher<A> = Data.TaggedEnum<{
  Exact: {},
  Fuzzy: { readonly scorer: (cached: A, query: A) => number }
}>

// Define the generic interface
interface ParamMatcherDefinition extends Data.TaggedEnum.WithGenerics<1> {
  readonly taggedEnum: ParamMatcher<this["A"]>
}

// Create the tagged enum constructor
export const ParamMatcher = Data.taggedEnum<ParamMatcherDefinition>()
```

## Convenience Exports

**Always re-export constructors and utilities** for ease of discovery and ergonomic usage:

```typescript
// Constructors
export const Exact = ParamMatcher.Exact
export const Fuzzy = <A>(scorer: (cached: A, query: A) => number) =>
  ParamMatcher.Fuzzy({ scorer })

// Pattern matching
export const match = ParamMatcher.$match

// Type guards
export const isFuzzy = ParamMatcher.$is("Fuzzy")
export const isExact = ParamMatcher.$is("Exact")
```

## Usage Patterns

### Creating Instances
```typescript
const exactMatcher = Exact()
const fuzzyMatcher = Fuzzy((cached, query) => similarity(cached, query))
```

### Pattern Matching with $match
```typescript
const result = pipe(
  matcher,
  match({
    Exact: () => performExactMatch(value),
    Fuzzy: ({ scorer }) => performFuzzyMatch(value, scorer)
  })
)
```

### Type Guards
```typescript
if (isFuzzy(matcher)) {
  // TypeScript knows matcher is Fuzzy variant
  const score = matcher.scorer(cached, query)
}
```

## Benefits

1. **Exhaustiveness checking**: TypeScript ensures all cases are handled
2. **Type narrowing**: Pattern matching and guards provide automatic type refinement
3. **Immutability**: Tagged enums are immutable by default
4. **Structural equality**: Uses `Data.TaggedEnum` equality semantics
5. **Clean syntax**: Pipeable pattern matching integrates with Effect pipelines

## Multi-Variant Examples

For more complex ADTs:

```typescript
export type Result<E, A> = Data.TaggedEnum<{
  Success: { readonly value: A },
  Failure: { readonly error: E },
  Pending: {}
}>

interface ResultDefinition extends Data.TaggedEnum.WithGenerics<2> {
  readonly taggedEnum: Result<this["A"], this["B"]>
}

export const Result = Data.taggedEnum<ResultDefinition>()

// Convenience exports
export const Success = <E = never, A = never>(value: A) =>
  Result.Success<E, A>({ value })
export const Failure = <E = never, A = never>(error: E) =>
  Result.Failure<E, A>({ error })
export const Pending = <E = never, A = never>() =>
  Result.Pending<E, A>()

export const match = Result.$match
```

## Integration with Effect Pipelines

Tagged enums work seamlessly with Effect's pipe-based composition:

```typescript
const processResult = (result: Result<string, number>) => pipe(
  result,
  match({
    Success: ({ value }) => Effect.succeed(value * 2),
    Failure: ({ error }) => Effect.fail(error),
    Pending: () => Effect.sync(() => 0)
  }),
  Effect.flatMap(value => /* continue processing */)
)
```

## When to Use

- Modeling domain states with distinct behaviors
- Representing computation outcomes (Success/Failure/Pending)
- Implementing protocol variants (Exact/Fuzzy matching)
- Any discriminated union requiring exhaustive handling
- State machines and workflow states
