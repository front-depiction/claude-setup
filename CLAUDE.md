# Claude Agent Guidelines

## Task Management Principles

### Avoid Task Jags

**Critical**: Avoid task jags at all cost. Jags are semantic changes in task direction:

- Going from implementing A to testing A
- Switching from implementing A to implementing B
- Any mid-stream change in the core task focus

Stay focused on the current task until completion. Delegate tasks to sub agents, and remain at a higher level of abstraction and coordination.

### Delegation Strategy

**Always delegate orthogonal tasks to sub-agents**. Use the most appropriate agent from `agents/` for each task:

- Break down complex work into focused sub-tasks
- Route each sub-task to the specialist agent best suited for it
- Maintain clear task boundaries between agents
- Give agents all the context they need, and instruction on where to gather more context if needed.

## Context Awareness

### Library Implementation Details

`.context` contains git submodules of libraries used (e.g., Effect). Agents are **highly encouraged** to grep for implementation details of the files they work with:

- `Graph.ts` for graph structures
- `Layer.ts` for dependency injection
- Other library sources as needed

This provides authoritative implementation patterns and ensures consistency with library conventions.

## Skills and Tools

### Leverage Available Skills

Use all skills that make semantic sense for the task:

- `domain-modeling` for ADTs and type-safe models
- `error-handling` for typed error patterns
- `layer-design` for dependency management
- `effect-testing` for comprehensive tests
- `service-implementation` for fine-grained services
- `pattern-matching` for tagged enums and discriminated unions
- And others as appropriate

### Ask Clarifying Questions

Ask clarifying questions often. Better to clarify upfront than to implement the wrong solution.

## Code Quality Standards

### High Signal-to-Noise Ratio

Strive for high signal-to-noise ratio in code:

- Clear, purposeful implementations
- Direct, readable solutions
- Declarative over imperative styles

### Structural Preferences

- **Avoid nested loops**: Prefer flat, pipeline-style code
- **Avoid deep nesting**: Keep nesting shallow (max 2-3 levels)
- **Prefer pipelines**: Use `pipe` for composing operations
- **Use ADTs with pattern matching**: Leverage tagged enums with `$match` for control flow

### Example Pipeline Style

```typescript
const result = pipe(
  data,
  Array.map(transform),
  Array.filter(predicate),
  Array.reduce(combine)
)
```

### Example Pattern Matching

```typescript
const result = pipe(
  matcher,
  match({
    Exact: () => exactMatch(value),
    Fuzzy: ({ scorer }) => fuzzyMatch(value, scorer)
  })
)
```

## Documentation Standards

### Minimal Documentation During Prototyping

**CRITICAL**: Forego all @example writing unless specifically asked to. Examples pollute context unnecessarily.

- **NO @example blocks** - They add significant context overhead
- **NO excessive JSDoc** - Keep it minimal unless requested
- **NO detailed comments** for self-explanatory code
- Focus on clean, self-documenting implementations
- Add documentation only when:
  - Explicitly requested by the user
  - Code is ready for production/publishing
  - Public API requires clarification

**Rationale**: During prototyping and development, examples and verbose documentation significantly bloat context. Write clear, readable code first. Documentation can be added later when actually needed.
