---
name: spec-driven-development
description: Implement the complete spec-driven development workflow from instructions through requirements, design, and implementation planning. Use this skill when starting new features or major refactorings that benefit from structured planning before coding.
---

# Spec-Driven Development

A rigorous five-phase workflow that captures requirements, designs solutions, and plans implementations before writing code. This approach ensures alignment, reduces rework, and creates living documentation.

## Critical Rule

**NEVER IMPLEMENT WITHOUT AUTHORIZATION**

After completing each phase, you MUST:
1. Present the completed work
2. Explicitly ask for user approval
3. Wait for clear confirmation
4. NEVER proceed automatically to the next phase

This is not optional. Each phase requires explicit user authorization.

## When to Use This Skill

Use spec-driven development for:
- **New features**: Any non-trivial feature requiring design decisions
- **Major refactorings**: Architectural changes affecting multiple components
- **API design**: Public interfaces that need careful consideration
- **Complex bugs**: Issues requiring investigation and design changes
- **Team coordination**: Work requiring clear communication and approval

Skip this process for:
- Trivial bug fixes (typos, simple logic errors)
- Documentation updates
- Configuration tweaks
- Minor refactorings with clear solutions

## Directory Structure

```
specs/
 README.md                      # Feature directory listing
 [feature-name]/
     instructions.md            # Phase 1: Raw requirements
     requirements.md            # Phase 2: Structured requirements
     design.md                  # Phase 3: Technical design
     plan.md                    # Phase 4: Implementation plan
```

The `specs/README.md` maintains a simple checkbox list of all features:

```markdown
# Feature Specifications

- [x] **[payment-intents](./payment-intents/)** - Payment intent workflow
- [ ] **[user-authentication](./user-authentication/)** - User auth system
- [ ] **[data-sync](./data-sync/)** - Real-time data synchronization
```

## Five-Phase Workflow

### Phase 1: Capture Instructions

**Goal**: Document raw user requirements without interpretation.

**Create**: `specs/[feature-name]/instructions.md`

**Contents**:
- Raw user requirements (exactly as provided)
- User stories ("As a [role], I want [feature] so that [benefit]")
- Acceptance criteria (what defines success)
- Constraints and dependencies
- Out of scope items (what this does NOT include)

**Template**:

```markdown
# [Feature Name] - Instructions

## Overview

[Brief description of what the user wants]

## User Stories

- As a [role], I want [feature] so that [benefit]
- As a [role], I want [feature] so that [benefit]

## Acceptance Criteria

- [ ] [Concrete, testable criterion]
- [ ] [Concrete, testable criterion]

## Constraints

- [Technical constraint]
- [Business constraint]
- [Timeline constraint]

## Dependencies

- [Existing feature or system]
- [External service]

## Out of Scope

- [What this feature does NOT include]
```

**After completion**:
1. Add entry to `specs/README.md`
2. Present instructions to user
3. Ask: "Does this accurately capture your requirements? Should I proceed to Phase 2 (Requirements)?"
4. **STOP and wait for approval**

---

### Phase 2: Derive Requirements

**REQUIRES APPROVAL FROM PHASE 1**

**Goal**: Transform raw instructions into structured, technical requirements.

**Create**: `specs/[feature-name]/requirements.md`

**Contents**:
- Functional requirements (what the system must do)
- Non-functional requirements (performance, security, scalability)
- Technical constraints (libraries, patterns, compatibility)
- Dependencies on other features or systems
- Data requirements (schemas, storage, validation)
- Error handling requirements

**Template**:

```markdown
# [Feature Name] - Requirements

## Functional Requirements

### FR-1: [Requirement Name]
**Priority**: High | Medium | Low
**Description**: [What must happen]
**Acceptance**: [How to verify]

### FR-2: [Requirement Name]
**Priority**: High | Medium | Low
**Description**: [What must happen]
**Acceptance**: [How to verify]

## Non-Functional Requirements

### NFR-1: Performance
- [Specific metric, e.g., "Response time < 100ms"]
- [Throughput requirement]

### NFR-2: Security
- [Authentication requirement]
- [Authorization requirement]

### NFR-3: Scalability
- [Concurrent users]
- [Data volume]

## Technical Constraints

- Must use [specific library or pattern]
- Must integrate with [existing system]
- Must support [platform or environment]

## Dependencies

### Internal
- [Feature or service name]: [Why needed]

### External
- [Library or API]: [Why needed]

## Data Requirements

### Schema
```typescript
export interface DataModel {
  readonly id: string
  readonly name: string
  readonly value: number
  readonly createdAt: Date
}
```

### Validation
- [Field-level validation rules]
- [Cross-field validation rules]

### Storage
- [Where data is stored]
- [Persistence strategy]

## Error Handling

- [Error scenario 1]: [Required handling]
- [Error scenario 2]: [Required handling]

## Traceability

- Addresses instructions: [Section references]
```

**Ask Questions**: Use `AskUserQuestion` tool if:
- Requirements are ambiguous or unclear
- Multiple valid approaches exist
- Trade-offs need user input
- Domain knowledge is missing
- Priority conflicts arise

**After completion**:
1. Present requirements to user
2. Ask: "Do these requirements accurately reflect the system needs? Should I proceed to Phase 3 (Design)?"
3. **STOP and wait for approval**

---

### Phase 3: Create Design

**REQUIRES APPROVAL FROM PHASE 2**

**Goal**: Make architectural decisions and design the solution.

**Create**: `specs/[feature-name]/design.md`

**Contents**:
- Architecture decisions (patterns, structure)
- API design (functions, types, interfaces)
- Data models (schemas with Effect Schema)
- Effect patterns to use (services, layers, streams)
- Error handling strategy (error types, recovery)
- Testing strategy (unit, integration, property tests)

**Template**:

```markdown
# [Feature Name] - Design

## Architecture Overview

[High-level description of the solution]

```text
   Component A
        ↓
        ↓
   Component B
```

## Architecture Decisions

### AD-1: [Decision Name]
**Context**: [Why this decision is needed]
**Decision**: [What was decided]
**Rationale**: [Why this approach]
**Alternatives**: [What was considered but rejected]
**Consequences**: [Implications of this decision]

### AD-2: [Decision Name]
[Same structure]

## API Design

### Public Interface

```typescript
import { Effect, Context } from "effect"

// Declare types used in examples
declare const Input1: unique symbol
declare const Output1: unique symbol
declare const Error1: unique symbol
declare const Deps1: unique symbol
declare const Input2: unique symbol
declare const Output2: unique symbol
declare const Error2: unique symbol
declare const Deps2: unique symbol

export interface FeatureService {
  readonly operation1: (input: typeof Input1) => Effect.Effect<typeof Output1, typeof Error1, typeof Deps1>
  readonly operation2: (input: typeof Input2) => Effect.Effect<typeof Output2, typeof Error2, typeof Deps2>
}
```

### Type Definitions

```typescript
import { Data } from "effect"

// Domain types
export interface DomainType {
  readonly field1: string
  readonly field2: number
}

// Error types
export class FeatureError extends Data.TaggedError("FeatureError")<{
  readonly reason: string
}> {}
```

## Data Models

### Schemas

```typescript
import { Schema } from "effect"

export const InputSchema = Schema.Struct({
  field1: Schema.String,
  field2: Schema.Number
})

export interface Input extends Schema.Schema.Type<typeof InputSchema> {}
```

### Validation Rules

- **field1**: Must be non-empty, max 100 characters
- **field2**: Must be positive integer

## Effect Patterns

### Services

- **FeatureService**: Main service providing feature operations
- **RepositoryService**: Data access layer
- **ValidationService**: Input validation

### Layers

```typescript
// Layer dependencies
// FeatureServiceLive
//     ├─ RepositoryServiceLive
//     │   └─ DatabaseLive
//     └─ ValidationServiceLive
//         └─ ConfigLive
```

### Error Handling

```typescript
import { Effect, Data } from "effect"

// Declare error types
declare class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
}> {}

declare class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string
}> {}

declare class BusinessRuleError extends Data.TaggedError("BusinessRuleError")<{
  readonly message: string
}> {}

// Error hierarchy
export type FeatureError =
  | ValidationError
  | DatabaseError
  | BusinessRuleError

// Recovery strategy example
declare const operation: Effect.Effect<string, FeatureError, never>

const recovered = operation.pipe(
  Effect.catchTags({
    ValidationError: (_e: ValidationError) => Effect.succeed("retry with corrected input"),
    DatabaseError: (_e: DatabaseError) => Effect.succeed("fallback to cache"),
    BusinessRuleError: (_e: BusinessRuleError) => Effect.succeed("notify user")
  })
)
```

### Streams (if applicable)

```typescript
import { Stream } from "effect"

// Declare types
declare const Update: unique symbol
declare type Update = typeof Update
declare const CustomError: unique symbol
declare type CustomError = typeof CustomError
declare const Deps: unique symbol
declare type Deps = typeof Deps

declare const source: EventSource
declare function parse(event: MessageEvent): Update
declare function validate(update: Update): boolean

// Real-time updates
const updates: Stream.Stream<Update, CustomError, Deps> =
  Stream.fromEventSource(source).pipe(
    Stream.map(parse),
    Stream.filter(validate)
  )
```

## Component Structure

### Files

```
src/
 FeatureService.ts          # Main service
 FeatureRepository.ts       # Data access
 FeatureSchema.ts           # Schemas and types
 FeatureError.ts            # Error definitions
 FeatureService.test.ts     # Tests
```

### Dependencies

```typescript
// Internal
import type { DatabaseService } from "../database"
import type { LoggerService } from "../logger"

// External
import { Schema, Effect, Layer, Stream } from "effect"
```

## Testing Strategy

### Unit Tests
- Test each service method in isolation
- Use test layers for dependencies
- Property-based testing for validation

### Integration Tests
- Test service with real database (test instance)
- Test error scenarios
- Test stream behavior

### Test Structure

```typescript
import { Effect, Layer, Context } from "effect"
import { describe, it, expect } from "vitest"

// Declare service interface
interface FeatureService {
  readonly operation: (input: string) => Effect.Effect<string, never, never>
}

const FeatureService = Context.GenericTag<FeatureService>("FeatureService")

// Declare layers
declare const FeatureServiceLive: Layer.Layer<FeatureService, never, DatabaseService | ConfigService>
declare const DatabaseTest: Layer.Layer<DatabaseService, never, never>
declare const ConfigTest: Layer.Layer<ConfigService, never, never>

// Declare types
declare const DatabaseService: Context.Tag<DatabaseService, {}>
declare const ConfigService: Context.Tag<ConfigService, {}>
declare const validInput: string
declare const expectedOutput: string

describe("FeatureService", () => {
  const TestLive = FeatureServiceLive.pipe(
    Layer.provide(DatabaseTest),
    Layer.provide(ConfigTest)
  )

  it("should handle valid input", () =>
    Effect.gen(function* () {
      const service = yield* FeatureService
      const result = yield* service.operation(validInput)
      expect(result).toEqual(expectedOutput)
    }).pipe(Effect.provide(TestLive), Effect.runPromise)
  )
})
```

## Performance Considerations

- [Caching strategy]
- [Batch operations]
- [Resource pooling]

## Security Considerations

- [Authentication checks]
- [Authorization rules]
- [Data sanitization]

## Traceability

- Addresses requirements: [FR-1, FR-2, NFR-1, etc.]
- Implements instructions: [Section references]
```

**Ask Questions**: Use `AskUserQuestion` for:
- Architecture choices (monolithic vs modular)
- Technology selections (which libraries)
- Error handling approaches
- Performance trade-offs
- Security requirements

**After completion**:
1. Present design to user
2. Ask: "Does this design meet your expectations? Should I proceed to Phase 4 (Plan)?"
3. **STOP and wait for approval**

---

### Phase 4: Generate Plan

**REQUIRES APPROVAL FROM PHASE 3**

**Goal**: Break down implementation into concrete, ordered tasks.

**Create**: `specs/[feature-name]/plan.md`

**Contents**:
- Task breakdown (specific, actionable items)
- Development phases (logical grouping)
- Dependencies between tasks
- Progress tracking structure
- Testing checkpoints
- Validation steps

**Template**:

```markdown
# [Feature Name] - Implementation Plan

## Overview

[Summary of implementation approach]

**Estimated Effort**: [Time estimate]
**Phases**: [Number of phases]

## Phase 1: Foundation

### Task 1.1: Define schemas and types
- [ ] Create `FeatureSchema.ts`
- [ ] Define input/output schemas
- [ ] Define error types
- [ ] Export type aliases

**Files**: `src/FeatureSchema.ts`, `src/FeatureError.ts`
**Dependencies**: None
**Validation**: `bun run typecheck`

### Task 1.2: Create service interface
- [ ] Define `FeatureService` interface
- [ ] Add JSDoc documentation
- [ ] Create Context.Tag

**Files**: `src/FeatureService.ts`
**Dependencies**: Task 1.1
**Validation**: `bun run typecheck`

## Phase 2: Implementation

### Task 2.1: Implement repository layer
- [ ] Create `FeatureRepository.ts`
- [ ] Implement data access methods
- [ ] Add error handling
- [ ] Create Live layer

**Files**: `src/FeatureRepository.ts`
**Dependencies**: Task 1.1, 1.2
**Validation**: `bun run typecheck && bun test FeatureRepository.test.ts`

### Task 2.2: Implement service
- [ ] Create service implementation
- [ ] Add business logic
- [ ] Implement error recovery
- [ ] Create Live layer

**Files**: `src/FeatureService.ts`
**Dependencies**: Task 2.1
**Validation**: `bun run typecheck && bun test FeatureService.test.ts`

## Phase 3: Testing

### Task 3.1: Unit tests
- [ ] Test schema validation
- [ ] Test service methods
- [ ] Test error scenarios
- [ ] Test edge cases

**Files**: `src/FeatureService.test.ts`
**Dependencies**: Task 2.2
**Validation**: `bun test`

### Task 3.2: Integration tests
- [ ] Test with live dependencies
- [ ] Test concurrent scenarios
- [ ] Test performance benchmarks

**Files**: `src/FeatureService.integration.test.ts`
**Dependencies**: Task 3.1
**Validation**: `bun test`

## Phase 4: Integration

### Task 4.1: Wire into application
- [ ] Export from main module
- [ ] Add to application layer
- [ ] Update documentation

**Files**: `src/index.ts`, `README.md`
**Dependencies**: Task 3.2
**Validation**: `bun run typecheck && bun test && bun run format`

### Task 4.2: Update examples
- [ ] Create usage example
- [ ] Add to examples directory
- [ ] Test example code

**Files**: `examples/feature-example.ts`
**Dependencies**: Task 4.1
**Validation**: `bun run examples/feature-example.ts`

## Quality Gates

After each phase:
- [ ] All files type-check: `bun run typecheck`
- [ ] All tests pass: `bun test`
- [ ] Code is formatted: `bun run format`
- [ ] No linting errors: `bun run lint` (if configured)

## Progress Tracking

Update this section as tasks complete:

- **Phase 1**: ⬜ Not started | 🔄 In progress | ✅ Complete
- **Phase 2**: ⬜ Not started | 🔄 In progress | ✅ Complete
- **Phase 3**: ⬜ Not started | 🔄 In progress | ✅ Complete
- **Phase 4**: ⬜ Not started | 🔄 In progress | ✅ Complete

## Rollback Plan

If implementation encounters blockers:
1. [Step to safely revert changes]
2. [How to restore previous state]
3. [What to preserve for retry]

## Traceability

- Implements design: [All architecture decisions]
- Satisfies requirements: [All FR and NFR items]
- Addresses instructions: [Original user stories]
```

**After completion**:
1. Present plan to user
2. Ask: "Does this implementation plan look correct? Should I proceed to Phase 5 (Implementation)?"
3. **STOP and wait for approval**

---

### Phase 5: Execute Implementation

**REQUIRES APPROVAL FROM PHASE 4**

**Goal**: Implement the solution exactly as planned.

**No new files**: Implementation follows the plan exactly.

**Process**:
1. Follow plan.md tasks in order
2. After EACH file created/modified:
   - Run `bun run format && bun run typecheck`
   - Fix any errors before proceeding
   - Update plan.md progress markers
3. Complete entire phase before tests
4. Run full test suite
5. Update plan.md with final status

**Implementation Rules**:
- Follow the design exactly as approved
- Use Effect patterns as specified
- Implement all error handling
- Add JSDoc documentation
- Keep commits atomic and descriptive

**Quality Checks**:
After each file:
```bash
bun run format && bun run typecheck
```

After each phase:
```bash
bun test
```

Final validation:
```bash
bun run format && bun run typecheck && bun test
```

**Progress Updates**:
Update `plan.md` after each task:
```markdown
### Task 2.1: Implement repository layer
- [x] Create `FeatureRepository.ts`
- [x] Implement data access methods
- [x] Add error handling
- [x] Create Live layer
```

**After completion**:
1. Present implementation summary
2. Show test results
3. Highlight any deviations from plan (with justification)
4. Ask: "Implementation complete. Would you like me to create a PR or make any changes?"

---

## Approval Checkpoints

Each phase has a mandatory checkpoint:

| Phase | Checkpoint Question |
|-------|-------------------|
| 1 → 2 | "Does this accurately capture your requirements? Proceed to Requirements?" |
| 2 → 3 | "Do these requirements reflect the system needs? Proceed to Design?" |
| 3 → 4 | "Does this design meet your expectations? Proceed to Plan?" |
| 4 → 5 | "Does this implementation plan look correct? Proceed to Implementation?" |
| 5 → ✓ | "Implementation complete. Create PR or make changes?" |

**Never skip these checkpoints.** Each phase builds on the previous, and changes cascade. Getting approval early prevents costly rework.

## When to Ask Questions

Use the `AskUserQuestion` tool liberally throughout:

### Phase 1 (Instructions)
- Clarify ambiguous requirements
- Resolve conflicting user stories
- Understand domain terminology
- Identify edge cases

### Phase 2 (Requirements)
- Prioritize requirements
- Resolve technical constraints
- Choose between valid approaches
- Define success metrics

### Phase 3 (Design)
- Select architecture patterns
- Choose libraries or frameworks
- Decide error handling strategies
- Resolve performance trade-offs

### Phase 4 (Plan)
- Sequence dependent tasks
- Estimate effort
- Identify risks
- Plan contingencies

### Phase 5 (Implementation)
- Handle unexpected issues
- Adjust for missing dependencies
- Resolve test failures
- Document deviations

**Question Quality**:
- Provide context for why you're asking
- Offer 2-4 concrete options
- Explain trade-offs of each option
- Recommend a default choice

Example:
```typescript
// Example of tool call structure (not executable TypeScript)
declare function AskUserQuestion(params: {
  questions: Array<{
    question: string
    header: string
    multiSelect: boolean
    options: Array<{
      label: string
      description: string
    }>
  }>
}): void

// Usage:
AskUserQuestion({
  questions: [{
    question: "How should we handle concurrent updates to the counter?",
    header: "Concurrency",
    multiSelect: false,
    options: [
      {
        label: "Last-write-wins",
        description: "Simple but may lose updates under high concurrency"
      },
      {
        label: "Optimistic locking",
        description: "Retry on conflict, guarantees no lost updates"
      },
      {
        label: "CRDT merge",
        description: "Automatic conflict resolution, complex but robust"
      }
    ]
  }]
})
```

## Quality Standards

Each specification document must:

### Clarity
- Use precise, unambiguous language
- Define all domain terms
- Include concrete examples
- Avoid vague words ("should", "might", "probably")

### Completeness
- Address all user requirements
- Cover error scenarios
- Document edge cases
- Include success criteria

### Traceability
- Link back to previous phases
- Reference source requirements
- Map to implementation tasks
- Enable impact analysis

### Effect Alignment
- Use Effect patterns (services, layers, streams)
- Leverage Effect error handling
- Design for composition
- Follow Effect best practices

### Testability
- Define measurable acceptance criteria
- Specify test scenarios
- Include performance benchmarks
- Enable automated validation

### Documentation
- Add inline code examples
- Include usage scenarios
- Document design rationale
- Explain trade-offs

## Common Pitfalls

### Skipping Phases
**Don't**: Jump straight to implementation
**Do**: Follow all five phases in order

### Assuming Requirements
**Don't**: Fill in gaps with assumptions
**Do**: Ask questions using `AskUserQuestion`

### Over-designing
**Don't**: Design for hypothetical future requirements
**Do**: Design for stated requirements with room to extend

### Under-planning
**Don't**: Create vague tasks like "implement feature"
**Do**: Break into concrete, testable subtasks

### Ignoring Feedback
**Don't**: Proceed when user requests changes
**Do**: Update specs and get re-approval

### Poor Traceability
**Don't**: Lose connection between phases
**Do**: Explicitly reference previous phase decisions

## Integration with Other Skills

Spec-driven development works with:

- **domain-modeling**: Use when designing domain types in Phase 3
- **service-implementation**: Apply during Phase 5 implementation
- **layer-design**: Reference when creating layers in Phase 3
- **typeclass-design**: Use for generic abstractions in Phase 3
- **effect-testing**: Apply test patterns in Phase 3 and 5

## Examples

### Small Feature: Add Logging
- Phase 1: "Add debug logging to payment flow"
- Phase 2: Log levels, what to log, PII handling
- Phase 3: Logger service design, Effect integration
- Phase 4: Update files, add logger calls, test
- Phase 5: Implement, verify logs appear

### Medium Feature: User Authentication
- Phase 1: Login, registration, password reset stories
- Phase 2: Security requirements, session management
- Phase 3: Service design, token strategy, error types
- Phase 4: Multi-phase plan (auth service, session, middleware)
- Phase 5: Implement all components with tests

### Large Feature: Real-time Sync
- Phase 1: Sync requirements across devices
- Phase 2: Conflict resolution, consistency guarantees
- Phase 3: CRDT design, stream architecture, error recovery
- Phase 4: Phased rollout (local, network, UI integration)
- Phase 5: Iterative implementation with progress updates

## Success Criteria

A successful spec-driven development cycle:

1. **Alignment**: Final implementation matches original user intent
2. **Quality**: All tests pass, code follows patterns
3. **Documentation**: Specs accurately describe implementation
4. **Traceability**: Clear path from instructions to code
5. **Maintainability**: Future developers understand design rationale
6. **Confidence**: User approved at each phase checkpoint

Remember: The goal is not perfect specs, but **shared understanding** and **documented decisions** that guide implementation and enable future maintenance.
