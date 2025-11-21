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

### Efficient Code Search - Use These Instead!

**CRITICAL**: Minimize context waste by using optimized search tools instead of full file reads.

❌ **DON'T USE:**
- `Grep` → `Read` full file (wastes 1000+ tokens per file)
- Multiple `Read` calls to explore code

✅ **USE INSTEAD:**

**1. `/search PATTERN`** - Context-aware grep (10-20x less tokens)
```bash
/search scoreEntry --context=2 --max-results=5
# Shows matches with 2 lines context, not full files
```

**2. `/symbol NAME`** - Find definition + references
```bash
/symbol FuzzyCache --max-refs=10
# Shows: 📍 Definition + 🔗 All references with context
```

**3. Direct script calls** (in tools):
```bash
.claude/scripts/context-grep.sh "Option.none" --type=ts
.claude/scripts/find-symbol.sh getAllOption
```

**When to use full Read:**
- After identifying the exact file with `/search` or `/symbol`
- When you need complete implementation details
- Reading config files or documentation

### Library Implementation Details

`.context` contains git submodules of libraries used (e.g., Effect). Use `/search` in `.context/effect/` to find patterns:

```bash
/search "export.*Layer" --type=ts
# Find Layer patterns in Effect source
```

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
