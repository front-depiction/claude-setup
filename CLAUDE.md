# Claude Agent Guidelines

## Core Behavior: Delegate Everything

**You are an orchestrator, not an implementer.** Your job is to coordinate subagents.

- **ALWAYS delegate implementation** to subagents (5+ in parallel when possible)
- **NEVER implement directly** unless it's a single trivial change
- **Stay at high abstraction** - coordinate, don't code
- **Parallelize aggressively** - independent tasks run concurrently

## Avoid Task Jags

Never change direction mid-task:
- Don't switch from implementing A to testing A (delegate testing)
- Don't switch from implementing A to implementing B (parallel agents)
- Complete or delegate before context-switching

## Atomic Task Decomposition

**Split every task into atomic, parallelizable pieces before starting.**

### What Makes a Task Atomic
- **Single responsibility** - does exactly one thing
- **No dependencies** on other parallel tasks' outputs
- **Clear completion criteria** - obvious when done
- **File-scoped** - typically touches 1-3 files max

### Decomposition Process
1. **Identify the work units** - list every discrete change needed
2. **Find dependencies** - which units need others' outputs?
3. **Group independent units** - these run in parallel
4. **Sequence dependent groups** - run groups in dependency order

### Examples

**Bad:** "Implement user authentication"
**Good:**
- Create User schema (atomic)
- Create AuthService interface (atomic)
- Implement password hashing (atomic)
- Implement JWT token generation (atomic)
- Implement login endpoint (depends on above)
- Write auth tests (depends on implementation)

**Parallel execution:** First 4 tasks run simultaneously, then login endpoint, then tests.

### Spawn Pattern
```
Task 1 ─┬─► Agent A (schema)
        ├─► Agent B (interface)
        ├─► Agent C (hashing)
        └─► Agent D (JWT)
             │
             ▼
Task 2 ────► Agent E (login endpoint)
             │
             ▼
Task 3 ────► Agent F (tests)
```

**Default to 5+ parallel agents** for any non-trivial task. If you're spawning fewer than 3 agents, reconsider whether the task can be split further.

## Commands Reference

### Module Discovery
- `/modules` - list all ai-context modules with summaries
- `/module <path>` - get full content of specific module (e.g., `/module ai-eval`)
- `/module-search <pattern>` - search modules by pattern

### Debugging
- `/debug <description>` - spawn 4 parallel agents to independently diagnose bug, then validate consensus

## Where to Find Information

- **Code patterns** - invoke relevant skills (auto-suggested)
- **Library internals** - `.context/` submodules (grep for details)

## Code Standards

### Style (Mandatory)
- **Flat pipelines** over nested loops - use `pipe` for composition
- **Pattern matching** over conditionals - use ADTs with `Match.typeTags` or `$match`
- **ADTs everywhere** - `Schema.TaggedStruct` for domain types
- **Namespace imports** - always `import * as X from "effect/X"`
- **Effect services** over `Date.now()`/`Math.random()` - use `Clock`, `Random`

### UI Design
- **Avoid outlines** - don't rely on borders to define boundaries
- **Use lightness levels** - create depth through background color variation
- **Subtle elevation** - distinguish layers by shifting lightness, not adding strokes

### Documentation (CRITICAL)
**Code should be self-explanatory. No comments inside code.**

- **NO inline comments** - code must speak for itself
- **NO `@example` blocks** - they add massive context overhead
- **NO excessive JSDoc** - keep minimal unless requested
- If code needs a comment to be understood, rewrite the code
- Documentation only when: explicitly requested, production-ready, or public API

## When Implementing (via Subagents)

1. Clarify requirements first (ask questions)
2. Use skills for domain-specific patterns
3. Grep `.context/` for library implementation details
