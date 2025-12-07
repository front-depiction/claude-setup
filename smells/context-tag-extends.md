---
name: context-tag-extends
description: Avoid class *Tag extends Context.Tag naming pattern
glob: "**/*.{ts,tsx}"
pattern: class\s+\w+Tag\s+extends\s+Context\.Tag
tag: do-not-extend-context-tag
severity: warning
---

# Avoid `class *Tag extends Context.Tag` Pattern

The `*Tag` suffix naming convention indicates unnecessary coupling between the interface and tag creation. This pattern makes services harder to mock and test, reduces flexibility, and couples the tag to specific implementations.

**Instead:** Define an interface for the service contract and create the tag separately using `Context.GenericTag`. This enables better testability with `Layer.succeed` for mocks, clear separation between contract and implementation, and easier refactoring.
