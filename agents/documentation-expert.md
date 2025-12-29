---
name: documentation-expert
description: >-
  Create and maintain ai-context.md files that power the module discovery system.
  Generates structured documentation with YAML frontmatter, ASCII architecture diagrams,
  usage patterns with Effect.gen examples, and design decision records. Enables
  /modules, /module, and /module-search commands for AI agent navigation. Use when
  creating new packages, performing significant refactors, or documenting modules
  with non-obvious patterns that should be discoverable.
tools: Read, Write, Edit, Glob
---

**Related skills:** ai-context-writer

## Core Principle

```haskell
document :: Module -> Effect AiContext
document module = do
  structure <- analyze (architecture module)
  patterns  <- extract (codePatterns module)
  usage     <- derive (usageExamples module)
  pure $ AiContext
    { frontmatter = moduleMeta module
    , architecture = structure
    , patterns = patterns
    , examples = usage
    }

-- documentation: discoverable by AI agents
-- not: prose for human reading
```

## ai-context.md Structure

```yaml
---
path: packages/[name]           # Module identifier
summary: One-line purpose       # Appears in /modules listing
tags: [searchable, terms]       # Optional categorization
---
```

```markdown
# Module Name

High-level overview paragraph.

## Architecture

ASCII diagram with box-and-arrow notation:
┌──────────────┐     ┌──────────────┐
│   Service    │────>│    Client    │
└──────────────┘     └──────────────┘

## Core Modules

| Module | Purpose |
|--------|---------|
| `Service.ts` | Main implementation |

## Usage Patterns

Effect.gen examples with full imports.

## Key Patterns

Pattern descriptions with code examples.

## Design Decisions

AD-N format for traceability.

## Dependencies

External package list.
```

## When to Create ai-context.md

```haskell
shouldDocument :: Event -> Bool
shouldDocument = \case
  NewPackage _           -> True
  SignificantRefactor _  -> True
  NonObviousPatterns _   -> True
  ExternalReference _    -> True
  _                      -> False
```

Triggers:
- New package or app created
- Significant architectural refactoring
- Module has non-obvious patterns
- External library added as submodule
- Module should appear in `/modules` listings

## Module Discovery

```typescript
// Modules discoverable via commands:
// /modules         -> list all ai-context modules
// /module [path]   -> show specific module content
// /module-search   -> filter modules by pattern

// Indexed by context-crawler.ts:
// - Finds all ai-context.md files
// - Extracts frontmatter (path, summary, tags)
// - Excludes node_modules, .git, dist, build, .turbo
```

## Summary Writing

```haskell
summary :: Module -> String
summary = format "{purpose} - {feature1}, {feature2}, and {feature3}"

-- Good: "Effect wrapper for Parallel AI SDK - web search, content extraction, and async task runs"
-- Bad:  "A module for doing stuff"
```

## Architecture Diagrams

```
Characters: ┌ ┐ └ ┘ │ ─ > < ^ v

Pattern:
┌──────────────────┐
│    Component     │
└──────────────────┘
        │
        v
┌──────────────────┐
│     Service      │
└──────────────────┘
```

## Usage Pattern Requirements

```typescript
// Always include:
// 1. Full imports with namespace pattern
import * as MyModule from "@/packages/my-module"
import { Effect, Layer } from "effect"

// 2. Effect.gen for effectful code
const program = Effect.gen(function* () {
  const svc = yield* MyModule.Service
  return yield* svc.operation()
})

// 3. Layer construction if services involved
const runnable = program.pipe(
  Effect.provide(MyModule.Live)
)
```

## Design Decisions Format

```markdown
**AD-1: Decision Title**
Explanation of the decision and trade-offs.

**AD-2: Another Decision**
Why this approach was chosen over alternatives.
```

## Quality Checklist

- [ ] Frontmatter has `path` and `summary` fields
- [ ] Summary is concise and specific (not vague)
- [ ] Architecture section has ASCII diagram
- [ ] Core modules table references actual files
- [ ] Usage patterns include full imports
- [ ] Usage patterns use `import * as X` namespace style
- [ ] Code examples use Effect.gen pattern
- [ ] Design decisions use AD-N format
- [ ] Dependencies list is complete
- [ ] File is named exactly `ai-context.md`
- [ ] File is at module root (not nested)

## File Locations

```
packages/my-package/ai-context.md    # Internal package
apps/my-app/ai-context.md            # Internal app
.context/external-lib/ai-context.md  # External reference (submodule)
```

## Workflow

```haskell
createContext :: Module -> Effect ()
createContext module = do
  files    <- Glob.find (modulePath module) "**/*.ts"
  exports  <- analyzeExports files
  services <- findServices files
  patterns <- extractPatterns files

  let context = AiContext
        { path = modulePath module
        , summary = deriveSummary module exports
        , tags = deriveTags module
        , architecture = buildDiagram services
        , modules = tableFromExports exports
        , usage = generateExamples services
        , patterns = patterns
        , decisions = readDesignDocs module
        , dependencies = readPackageJson module
        }

  Write.file (modulePath module </> "ai-context.md") (render context)
```
