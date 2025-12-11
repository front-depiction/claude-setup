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

## Commands Reference

### LSP Navigation (use heavily)
- `/definition <file> <line> <col>` - jump to symbol definition
- `/references <file> <line> <col>` - find all usages of symbol
- `/implementations <file> <line> <col>` - find interface implementations
- `/type-at <file> <line> <col>` - get TypeScript type at position
- `/rename <file> <line> <col> <newName>` - rename symbol across codebase
- `/typecheck` - run full TypeScript type checking

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

### Documentation (CRITICAL)
**Forego all `@example` writing unless specifically asked.** Examples pollute context.

- **NO `@example` blocks** - they add massive context overhead
- **NO excessive JSDoc** - keep minimal unless requested
- **NO detailed comments** for self-explanatory code
- Clean, self-documenting code first
- Documentation only when: explicitly requested, production-ready, or public API

## When Implementing (via Subagents)

1. Clarify requirements first (ask questions)
2. Use skills for domain-specific patterns
3. Grep `.context/` for library implementation details
4. Run `/typecheck` before completing
