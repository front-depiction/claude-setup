# Project Configuration

This configuration is for Effect TypeScript projects following functional programming principles.

## Key Principles

- **Effect-first**: All side effects tracked in the type system
- **Type safety**: Leverage TypeScript's type system for correctness
- **Composition**: Build complex behavior from simple, composable pieces
- **Immutability**: All data structures are immutable by default

## Project Structure

All commands run from `/convex` directory:
- Source code: `src/convex/`
- Tests: `src/convex/**/*.test.ts`
- Package manager: **Bun** (not npm/pnpm)

## Development Commands

- `bun run build` — Build for production
- `bun run typecheck` — Type checking
- `bun run format` — Format code
- `bun run lint` — Lint code
- `bun run test` — Run tests
- `bun run test:watch` — Watch mode

## Critical Rule

After **every** file change in `src/convex`:
1. Run `bun run format`
2. Run `bun run lint`
3. Run `bun run typecheck`
4. Fix all errors before proceeding

**Note**: Hooks are configured to run these automatically after file changes.

## Specialized Agents

This project uses specialized agents for specific tasks:

- **domain-modeler**: Creates ADT-based domain models with typeclasses
- **effect-expert**: Implements Effect services, layers, and dependency injection
- **spec-writer**: Handles spec-driven development workflow
- **react-expert**: Implements compositional React patterns with Effect Atom
- **test-writer**: Writes tests using @effect/vitest

Claude will automatically invoke the appropriate agent based on your task.

## Documentation

Full reference guides are in `docs/`:
- `docs/clean-code-guide.md` - Complete patterns and best practices
- `docs/effect-patterns.md` - Effect-specific implementation patterns

Agents have access to these references when needed.
