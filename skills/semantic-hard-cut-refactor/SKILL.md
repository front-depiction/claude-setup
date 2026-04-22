---
name: semantic-hard-cut-refactor
description: Execute a structural or API refactor as a semantic hard cut: settle producer truth first, delete unnecessary surface, eliminate alternate constructor families, preserve guarantees, and prove boundary parity. Use after algebra extraction.
---

# Semantic Hard-Cut Refactor

## Purpose

A hard cut is justified when the existing surface is not necessary, not
sufficient, or not truthful.

A refactor should do one or more of the following:

1. preserve semantics while simplifying realization,
2. complete an incomplete algebra,
3. move smuggled semantics into represented form,
4. remove unnecessary moving parts,
5. repair the realized boundary/topology so it matches the intended ontology.

Do not preserve an extra surface merely because it exists.

This skill is also **deontic**. It must render admissibility judgments, not
merely soft classifications. For the relevant structure, conclude one of:
- admissible,
- inadmissible,
- temporary debt with explicit exit condition.

---

## Precondition

Read and apply `lawful-systems-engineering` first.
This skill assumes the algebra extraction report produced by that skill.
A hard cut without prior lawful-systems analysis is inadmissible.

A hard cut requires an algebra extraction report.
No refactor plan is valid if it is based on unverified assumptions about a host
library, runtime, or constructor surface.
Skepticism is required: do not assume the current code is using the full public
API or strongest guarantees of the libraries it depends on.

Required input:

```text
.context/explorations/YYYY-MM-DD-<subsystem>-algebra-extraction.md
```

If absent, produce it first.

---

## Refactor Law

A hard cut is valid only if the new surface is:

- **necessary**: no retained moving part lacks semantic justification
- **sufficient**: the new surface still realizes the required behavior and guarantees
- **truer**: the public ontology is closer to the intended algebra than before
- **smaller or sharper**: fewer redundant paths, fewer ad hoc variants, less semantic branching

If a change adds moving parts but does not add guarantees, canonical boundaries,
or significant proof simplification, it is presumptively invalid.
If the added moving part is justified only by an unverified assumption about how
a host library or runtime works, reject it until the assumption is proven.
If the new surface causes code to become more scaffolding-heavy and less domain-
logic-shaped, treat that as evidence against the change unless a guarantee gain
or canonical boundary justifies it.

---

## Producer-First Principle

Settle producer truth before consumer convenience.

Truth order:
1. public boundary
2. emitted/runtime/persisted semantics
3. construction internals
4. consumers

If consumers depend on a misleading producer surface, change consumers after
correcting producer truth.

---

## Elimination Principle

If a helper, wrapper, or constructor does not add necessary semantic value,
delete it.

A new surface is justified only if:

```text
Necessary(n) ∨ GuaranteeImproving(n) ∨ BoundaryExposing(n)
```

Otherwise:

```text
InvalidByDefault(n)
```

Where:

```text
Necessary(n) iff ¬∃ c_existing . Γ* ⊆ Γ(c_existing)
GuaranteeImproving(n) iff ∃ c_old . Γ(n) ⊋ Γ(c_old)
BoundaryExposing(n) iff n introduces a canonical boundary that removes
  repeated non-local proof burden without weakening guarantees
```

Therefore:

- if the old composition already suffices, a new helper is unnecessary
- if the new helper has weaker guarantees than the old composition, it is
  guarantee-regressive indirection
- if the new helper merely adds one more way to do the same thing, it increases
  semantic branching and learning burden without justification

Compact rule:

> Prefer completing the algebra to adding ad hoc surface.

Secondary rule:

> Prefer code that reads as domain logic over code that reads as hand-rolled infrastructure.

---

## Dominance Test

Let:

- `Γ(c)` = guarantees of construction/surface `c`
- `σ(c)` = moving-part / indirection / learning-surface cost of `c`

Define:

```text
c₁ ⪰ c₂  iff  Γ(c₁) ⊇ Γ(c₂) ∧ σ(c₁) ≤ σ(c₂)
c₁ ≻ c₂  iff  c₁ ⪰ c₂ ∧ (Γ(c₁) ⊋ Γ(c₂) ∨ σ(c₁) < σ(c₂))
```

If an existing composition or surface `c_existing` strictly dominates a proposed
surface `n`, reject `n`.

Deontic consequence:

```text
c_existing ≻ n ⇒ Inadmissible(n)
```

This is the formal test for "extra moving part is strictly worse".

---

## Wrong Constructor Topology

A special case of dominated surface is wrong constructor topology.

If a semantic object already has an authoritative constructor, an alternate
constructor family is admissible only if:

```text
SemanticallyInert(AltCtor)
∨ Γ(AltCtor) ⊋ Γ(Ctor)
∨ CanonicalBoundary(AltCtor)
```

Otherwise reject it.

Internal-only status is not a sufficient defense:

```text
InternalOnly(AltCtor) ⇏ Admissible(AltCtor)
```

A stronger outer wrapper is not a sufficient defense:

```text
RewrappedByStrongerOuter(AltCtor) ⇏ Admissible(AltCtor)
```

A sync helper is semantically inert **iff** it is:

- pure or observationally pure,
- non-acquiring,
- non-subscribing,
- non-scheduling,
- non-owning of teardown,
- non-authoritative for instantiation,
- and non-memoizing for shared semantic identity.

If these conditions fail, it is an alternate constructor, not a harmless helper.

### Bad shapes

- sync `createX`, `makeX`, `buildX`, `initX` for an object already constructed by
  a layer/provider/runtime
- eager parent-level construction of objects whose runtime semantics are lazy or
  demand-driven
- constructor helpers that own teardown, subscriptions, or shared state

### Refactor move

- eliminate alternate constructor families
- keep meaningful construction in the authoritative runtime constructor
- permit only semantically inert local helpers
- restore lawful instantiation timing and lifetime ownership
- if a weaker constructor is only made lawful by a stronger outer wrapper,
  fuse construction into the stronger system and delete the weaker intermediate

---

## Common Refactor Targets

### 1. Wrong abstraction family
The old surface presents the wrong conceptual unit.

Examples:
- a `helpers` file that actually encodes first-class runtime semantics
- convenience API that obscures algebraic structure
- broad service hiding distinct authorities

Refactor move:
- expose the real module/concept directly
- delete the misleading facade if possible

### 2. Smuggled lifetime protocol
The old surface externalizes lifecycle responsibility.

Examples:
- `{ thing, dispose }`
- manual subscription arrays
- constructors with hidden readiness assumptions

Refactor move:
- represent lifetime explicitly
- relocate teardown to the proper owner
- restore failure/readiness states if they were collapsed

### 3. Boundary leakage
Internal mechanism leaked into public truth.

Examples:
- addressing/indexing names in exported API
- persistence details in public types
- runtime internals exposed as consumer contract

Refactor move:
- restore contract-first boundary
- keep internal vocabulary internal

### 4. Residual dual ontology
Both old and new surfaces remain available, teaching conflicting mental models.

Refactor move:
- choose the canonical surface
- remove or quarantine the obsolete one

### 5. Dominated helper surface
The new or old helper is strictly dominated by existing composition.

Examples:
- introducing a bespoke test helper when production primitives already compose
  to build the same world
- extracting a sync constructor from a layer/runtime constructor with weaker
  guarantees and more indirection

Refactor move:
- delete the dominated surface
- keep the smaller stronger composition path

---

## Hard-Cut Procedure

### Step 1: State the semantic reason for the cut
Do not begin with file moves or renames.

State:
- what old surface teaches incorrectly,
- what guarantee is being protected,
- what semantics are being made explicit,
- why the old representation is misleading,
- and why the retained surface is necessary and sufficient.

### Step 2: Settle the producer boundary
Define the intended public truth:
- module structure,
- exported types,
- payload shapes,
- state/lifetime semantics,
- capability ownership,
- constructor authority.

Make this boundary correct before adapting every consumer.

### Step 3: Rebuild internals around the right semantics
Re-express internals in terms of:
- the correct capability model,
- the correct lifetime model,
- the correct algebraic primitives,
- the correct source of truth,
- the correct constructor topology.

### Step 4: Adapt consumers to the new boundary
Consumer edits come after producer truth is settled.

Do not let a convenient consumer patch justify keeping an incorrect producer
surface.

### Step 5: Eliminate residue
Search for:
- old names
- old module paths
- old helper imports
- old payload vocabulary
- old lifecycle protocol shapes
- old constructor families
- comments/docs teaching the old model

Residue hunting is mandatory after hard cuts.

### Step 6: Prove parity or intentional delta
Verify:
- type-level contract,
- runtime boundary behavior,
- payload shapes,
- lifecycle behavior,
- failure/initial/replay semantics,
- deletion timing or cleanup semantics,
- constructor authority and instantiation timing where relevant.

Do not stop at "it compiles".

---

## Verification Principles

### Verify the boundary, not just internals
Test:
- exported surfaces
- actual runtime emissions
- observable state transitions
- lifecycle semantics
- error/failure states
- persistence/serialization surfaces
- constructor and instantiation semantics where relevant

### Verify package truth before downstream comfort
Where packages/modules are involved:
- first make the local package or subsystem truthful,
- then adapt downstream code.

Do not preserve a wrong package boundary because a consumer is still written
against it.

### Verify residue is gone
A hard cut is not complete if the old ontology remains searchable across docs,
imports, comments, tests, and public examples.

### Verify actual produced values
Do not rely only on compile-time shape. Inspect actual runtime
values/payloads/state transitions where semantics matter.

---

## Required Plan

Persist the hard-cut plan:

```text
.context/plans/YYYY-MM-DD-<subsystem>-semantic-hard-cut.md
```

Required sections:

1. old ontology
2. new ontology
3. unnecessary surface to delete
4. missing representation to add
5. guarantees preserved
6. intentional delta
7. producer-first sequence
8. consumer adaptation sequence
9. residue hunt
10. verification
11. dominance test for added/removed surfaces
12. constructor authority changes, if any

---

## Canonical Example Shapes

### Example: runtime constructor plus extracted sync constructor

Bad shape:

```ts
const Live = Layer.scoped(
  Effect.gen(function* () {
    const dep = yield* Dep
    const { thing, dispose } = createThing({ dep })
    return ...
  }),
)
```

when `createThing` materially constructs the semantic object rather than
performing pure local computation.

Diagnosis:
- duplicate constructor family
- environment collapse
- possible eagerization regression
- constructor indirection without semantic gain
- repair-requiring intermediate if the outer layer must restore guarantees the
  inner constructor lacks

Refactor:
- keep construction in the layer/runtime owner
- restrict helpers to semantically inert local computation
- if the stronger system can construct directly, fuse away the weaker inner
  constructor

### Example: bespoke test helper when composition already suffices

If the same lawful production primitives already compose to build an RPC/service
world for tests, adding a bespoke test helper is presumptively unnecessary.

Justify such a helper only if it:
- exposes a missing canonical test boundary,
- materially reduces repeated non-local proof burden,
- or strengthens guarantees without introducing semantic branching.

Otherwise delete it.

---

## Output Contract

When using this skill, provide:

### 1. Cut intent
- old surface:
- new surface:
- semantic reason:
- guarantee preserved:
- intentional delta:

### 2. Surface economy judgment
- why retained surface is necessary:
- why deleted surface was unnecessary or dominated:
- whether any new surface is guarantee-improving or boundary-exposing:
- whether the resulting code is more domain-logic-shaped and less infrastructure-heavy:
- whether any retained temporary debt is explicitly labeled with exit condition:

### 3. Boundary plan
- producer truth:
- consumer adaptations:
- compatibility kept or removed:
- residue to eliminate:

### 4. Verification plan
- boundary tests:
- runtime observations:
- lifecycle/failure checks:
- constructor-authority checks:
- residue hunt:
