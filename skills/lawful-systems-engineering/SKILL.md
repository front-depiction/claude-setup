---
name: lawful-systems-engineering
description: Recover ontology, epistemology, guarantees, host algebras, constructor authorities, and local algebras of a subsystem before editing it. Use for refactors, architecture work, shared/runtime code, service design, state/lifecycle design, public-surface changes, and any task where semantic preservation, algebra completion, or reduction of unnecessary moving parts matters.
---

# Lawful Systems Engineering

## Purpose

Treat the repository as a semantic system.

Your task is not to aesthetically rewrite code. Your task is to recover the
local ontology, determine the governing laws, and construct the minimal surface
that is **necessary and sufficient** to realize the intended algebra and satisfy
the intended guarantees.

This skill is not only descriptive; it is also **deontic**. It does not merely
classify what the code is doing. It determines what is admissible,
inadmissible, required, forbidden, or acceptable only as temporary debt under
explicit proof burden.

Implementation is evidence. It is not automatically doctrine.

A subsystem may be:

- a **lawful witness** of its algebra,
- a **partial witness**,
- **residue** from an older ontology,
- a **counterexample** revealing collapsed semantics,
- or a **missing witness** where the semantics are clearly needed but not yet
  represented.

The default stance is:

- prefer **composition** of existing lawful parts,
- reject **extra moving parts** that add no new guarantee,
- and move smuggled semantics into represented form.

---

## Notation

```text
S            subsystem
L            host library / runtime / tool
x            service or semantic object
Γ*           required guarantee set
Γ(c)         guarantees provided by construction/surface c
σ(c)         semantic surface cost / moving-part count / indirection burden
Ctor(x)      authoritative constructor for x
HostAlg(L)   public algebra of host dependency L
Use(S, L)    realized usage of L inside S
Needs(x)     capabilities behavior requires
Grants(x)    capabilities explicitly granted
Bound(S)     public boundary / contract surface
```

Logical symbols:

```text
⊆   subset
⊊   strict subset
⊋   strict superset
∧   and
∨   or
¬   not
⇒   implies
iff if and only if
∃   there exists
∀   for all
∘   composition
⪰  at least as good as
≻   strictly dominates
```

---

## Epistemology

Truth precedence:

1. local doctrine: architecture docs, AGENTS, ai-context, README, formal notes,
   specs
2. public contracts: exports, types, canonical tests
3. examples
4. implementation
5. comments
6. generic prior knowledge

Therefore:

- assume you do **not** yet understand a host library, runtime, or tool until you
  have read its public surface and canonical tests/examples
- be skeptical that the current code uses the full surface area of the library it
  depends on
- do not infer the semantics of a library from one local usage site
- do not normalize doctrine downward to match accidental implementation
- do not treat an existing helper surface as justified merely because it exists
- when doctrine and implementation diverge, classify the implementation rather
  than blindly obey it
- prefer proof, textual evidence, public contracts, and canonical tests over
  intuition or analogy
- humility is mandatory: assumptions are weak evidence; proofs and explicit
  semantics are strong evidence

Admissibility law:

```text
ArchitecturalClaim(p) admissible ⇒ Evidence(p) ≥ RequiredEvidence(p)
```

For claims about host-library semantics, constructor authority, lifetime
semantics, or public boundaries:

```text
RequiredEvidence(p) = Doctrine ∨ PublicContract ∨ CanonicalTests
```

Compact skepticism rule:

> Local usage is not a sufficient basis for host semantics.

Deontic rule:

> Do not bend to codebase residue, user convenience, or implementation laziness
> without due process. Semantic claims require evidence; architectural changes
> require admissibility.

Use these classifications:

- **lawful witness** — directly realizes the intended algebra
- **partial witness** — captures some semantics but leaves others informal
- **residue** — reflects an older ontology still present in the codebase
- **counterexample** — violates, collapses, or obscures the intended semantics
- **missing witness** — the semantics are required, but no explicit
  representation exists

Shady code is evidence. It may be a witness, residue, workaround, or
counterexample. Do not assume it is the best realization of the algebra.
The burden of proof is on any claim that "this is how the system works" when
that claim has not been checked against doctrine, public contracts, and
canonical tests.

---

## Ontology

For a subsystem `S`, recover:

```text
Host(S)       -- semantically central libraries/tooling
HostAlg(L)    -- public algebra of a host library/tool L
Cap(S)        -- capabilities / semantically meaningful powers
Serv(S)       -- authoritative service boundaries
Alg(S)        -- local algebras: composition, lifetime, failure, ownership, boundary
Life(S)       -- acquisition, liveness, release, cancellation, replay
G(S)          -- guarantees: safety, liveness, ownership, boundary, observational, temporal
Bound(S)      -- public truth vs internal mechanism
Ctor(S)       -- authoritative constructor surfaces
Smell(S)      -- semantic collapse, hidden substrate, capability leakage, bypassed algebra
```

For a service or semantic object `x`, recover:

```text
Needs(x)      -- capabilities behavior actually requires
Grants(x)     -- capabilities explicitly granted by dependencies
Owns(x)       -- state/resources/lifetimes authoritatively controlled
Obs(x)        -- inputs/events/results observed
Pub(x)        -- outputs/state/events made visible
Ctor(x)       -- authoritative constructor surface
Env(x)        -- lawful environment/capability model
Time(x)       -- instantiation law: lazy/eager/scoped/memoized/demand-driven
```

Necessary checks:

```text
Needs(x) ⊆ Closure(Grants(x))
```

If false, there is likely:

- ambient authority,
- hidden substrate,
- capability leakage,
- or under-modeled coupling.

A constructor is not merely code that returns a value. A constructor is the
**authority over existence** for `x`: under what capabilities it may exist, when
it comes into existence, who owns its lifetime, whether it is lazy or eager,
how it is shared, and how it is finalized.

---

## Host Algebra Recovery

Before treating local code as authoritative, recover the host algebra of each
semantically central dependency.

For each important library/tool `L`, identify:

```text
Carrier(L)       -- principal value/state/resource carriers
Constructors(L)  -- how valid values/resources are introduced
Destructors(L)   -- how values/resources are observed, consumed, discharged, or finalized
Combinators(L)   -- lawful composition operators
Life(L)          -- lifetime/resource semantics
Fail(L)          -- failure/initial/readiness semantics
Tests(L)         -- canonical tests/examples specifying behavior
```

Then compare:

```text
Use(S, L) ⊆ HostAlg(L)
ClaimAbout(L) admissible ⇒ Recovered(HostAlg(L))
```

Interpretation:

- if `Use(S, L)` is a thin, distorted, or ad hoc subset of `HostAlg(L)`, suspect
  **host algebra under-realization**
- if local code rebuilds semantics already offered by `HostAlg(L)`, suspect
  **local reimplementation of host semantics**
- if local wrappers teach a weaker or misleading model than `HostAlg(L)`, suspect
  **distorted teaching surface**
- if the code-to-domain-logic ratio is high, suspect that the subsystem may be
  hand-rolling machinery the host algebra already provides

Necessary reading order for each semantically central dependency:

1. public docs / architecture / README / ai-context
2. public exports / types / modules
3. canonical tests or spec-style tests
4. examples
5. implementation internals, only if needed

Do not invert this order.
Do not make design decisions about a host library or runtime before completing
at least steps 1-3. If you have not read the public surface and canonical tests,
you do not yet have sufficient evidence to claim how the dependency works.

---

## Constructor Authority and Environment Semantics

Recover, for each semantic object `x` under edit:

```text
Ctor(x)     -- authoritative constructor surface
Env(x)      -- lawful environment/capability model
Life(x)     -- acquisition, ownership, teardown, cancellation semantics
Time(x)     -- instantiation timing: lazy/eager/scoped/memoized/demand-driven
```

A constructor is not merely code that returns a value. A constructor is the
authority that decides:

- under what capabilities `x` may exist,
- who acquires those capabilities,
- who owns `x`'s lifetime,
- when `x` comes into existence,
- whether `x` is lazy, shared, memoized, or eagerly realized,
- and how `x` is finalized.

Therefore:

- explicit dependency passing is **necessary** for local clarity but **not
  sufficient** for lawful environment modeling
- a sync closure/parameter list is not semantically equivalent to a runtime
  environment
- if `Ctor(x)` already exists as a layer/provider/runtime-managed constructor, a
  second constructor family for `x` is presumptively unlawful

A sync helper is admissible **iff** it is semantically inert:

- pure or observationally pure,
- non-acquiring,
- non-subscribing,
- non-scheduling,
- non-memoizing for shared semantic identity,
- non-owning of teardown,
- and non-authoritative for instantiation.

If these conditions fail, the helper is not merely a helper; it is an alternate
constructor.

High-signal smells:

- duplicate constructor family
- environment collapse
- eagerization regression
- constructor indirection without semantic gain

Containment rule:

```text
Contained(x) ≠ Justified(x)
```

A construction can be locally contained yet still be architecturally
inadmissible. Rewrapping a weaker inner constructor in a stronger outer system
may reduce blast radius, but does not by itself justify the weaker extraction.

---

## Guarantee Extraction

Recover guarantees in these classes.

### Safety
What must never occur?

### Liveness
What must eventually occur?

### Ownership
Who has authority to write, release, or decide lifecycle?

### Boundary
What is public truth, and what must remain internal?

### Observational
What can consumers observe about values, failures, ordering, replay, cleanup,
removal?

### Temporal
What states or transitions exist over time, and what sequencing laws govern
them?

State each guarantee propositionally, not vaguely.

Examples:

- "acquired resources are released on completion or interruption"
- "loading/failure remain observable at the boundary"
- "internal addressing terms do not leak into public contract"
- "a consumer cannot exercise DB capability without an explicit grant"
- "runtime-owned construction remains lazy and demand-driven"

---

## Algebra Extraction

Recover the relevant local algebras.

### Composition algebra
How do values/events/services compose?
Identify:

- carriers
- primitive combinators
- derived combinators
- identity / zero
- closure properties
- key laws

### Lifetime algebra
How are resources acquired, kept live, and released?
Identify:

- acquire/use/release structure
- cancellation propagation
- replay or activation semantics
- liveness conditions
- teardown owner

### Failure algebra
How are failure and temporal knowledge represented?
Identify:

- explicit sum types
- initial/loading/success/failure distinctions
- retry/fallback structure
- where failure becomes observable

### Ownership algebra
How is authority distributed?
Identify:

- single-writer rules
- authoritative vs derived state
- read-only vs mutable surfaces
- lifecycle ownership

### Boundary algebra
How do internal and external representations correspond?
Identify:

- exported surfaces
- payload shapes
- persistence/wire shapes
- adapter boundaries
- internal vocabulary that must remain internal

A system is cleaner when more behavior is obtained by composition inside these
algebras and less behavior requires new ad hoc surfaces.
The mathematical preference is for a smaller generating set with stronger
closure, not for more parallel surfaces teaching the same semantics.

---

## Minimal Sufficiency and Surface Economy

This is a hard rule.

Let:

- `Γ*` = required guarantee set
- `c` = a construction or surface
- `Γ(c)` = guarantees actually provided by `c`
- `σ(c)` = semantic surface / moving-part cost / indirection burden of `c`

A construction is **sufficient** iff:

```text
Γ* ⊆ Γ(c)
```

A construction is **minimal sufficient** iff:

```text
Γ* ⊆ Γ(c)
∧ ¬∃ c'. (Γ* ⊆ Γ(c') ∧ σ(c') < σ(c))
```

A new surface `n` is justified only if at least one of the following holds:

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

- if existing lawful primitives already compose to a sufficient construction,
  adding a new helper is presumptively unnecessary
- if a proposed extraction adds surface while preserving no additional
  guarantees, it is **pure indirection**
- if a proposed extraction adds surface and weakens guarantees, it is
  **guarantee-regressive indirection** and should be rejected

Strict domination relation:

```text
c₁ ⪰ c₂  iff  Γ(c₁) ⊇ Γ(c₂) ∧ σ(c₁) ≤ σ(c₂)
c₁ ≻ c₂  iff  c₁ ⪰ c₂ ∧ (Γ(c₁) ⊋ Γ(c₂) ∨ σ(c₁) < σ(c₂))
```

If an existing construction `c_existing` strictly dominates a proposed surface
`n`, reject `n`.

Deontic consequence:

```text
c_existing ≻ n ⇒ Forbidden(n)
```

Compact rule:

> If a desired behavior is realizable by a short composition of existing lawful
> primitives, introducing a new helper surface is unnecessary unless it
> discharges a repeated non-local proof obligation or exposes a missing
> canonical boundary.

Uniform composition is semantically preferable to parallel ad hoc surfaces.
More moving parts are strictly worse unless they buy a necessary guarantee,
canonical boundary, or major simplification without guarantee loss.
The target shape is code that reads primarily as domain logic; if scaffolding,
plumbing, or helper code dominates domain code, suspect dominated surface,
host-algebra under-realization, or misplaced boundaries.

---

## Represented vs Smuggled Semantics

Prefer represented semantics.

### Represented semantics
Encoded explicitly in:

- types
- services
- layers/providers
- scopes/resources
- state machines
- algebraic combinators
- public contracts

### Smuggled semantics
Encoded implicitly in:

- constructor timing
- manual cleanup conventions
- global state
- ambient singletons
- hidden subscriptions
- ad hoc callback webs
- mirrored writable state
- call-order assumptions

Smuggled semantics are suspect because they move semantic content outside the
explicit logical system.

Refactoring often means completing the logical system by moving smuggled
semantics into represented form.

---

## High-Signal Smells

- **semantic collapse** — a richer semantic object is flattened into a weaker one
- **host algebra under-realization** — the library supports more lawful structure than the subsystem uses
- **local reimplementation of host semantics** — local code rebuilds composition/lifetime/failure machinery already available
- **smuggled lifetime** — lifecycle is managed manually rather than in the explicit lifetime algebra
- **duplicate authority** — more than one writable or constructing source of truth without an explicit coordination law
- **boundary leakage** — internal mechanism becomes public truth
- **hidden substrate** — behaviorally significant coupling is not represented explicitly
- **capability leakage** — a service exercises powers beyond its explicit grants
- **distorted teaching surface** — the public API teaches a weaker model than the underlying algebra actually supports
- **duplicate constructor family** — a second surface claims authority to construct the same semantic object
- **environment collapse** — runtime environment semantics collapse into sync parameter passing or closure state
- **eagerization regression** — lazy/scoped/demand-driven construction is replaced by eager construction
- **constructor indirection without semantic gain** — one more path to instantiate the same thing with no new guarantee
- **high scaffolding-to-domain ratio** — too much non-domain code relative to actual domain logic; often evidence of hand-rolled machinery, under-realized host algebra, or unnecessary surface

---

## Canonical Example Shapes

## Presumptive Invalidity Rules

For shared/runtime/lifecycle/construction work, the following are invalid by
default and require an explicit exception proof:

```text
InvalidByDefault(AltCtor(x))
InvalidByDefault(GuaranteeDowngrade(x))
InvalidByDefault(DominatedSurface(x))
InvalidByDefault(RepairRequiringIntermediate(x))
```

Internal-only status is not a sufficient defense:

```text
InternalOnly(x) ⇏ Admissible(x)
```

Rewrapping by a stronger outer system is not a sufficient defense:

```text
RewrappedByStrongerOuter(x) ⇏ Admissible(x)
```

A structure becomes admissible only if one of the explicit exception classes is
proven:

```text
SemanticallyInert(x)
∨ GuaranteeImproving(x)
∨ CanonicalBoundary(x)
∨ TemporaryMigrationDebt(x)
```

Where `TemporaryMigrationDebt(x)` requires:
- explicit debt labeling,
- bounded scope,
- exit condition,
- and planned removal.

## Constructor Fusion and Repair-Requiring Intermediates

If a weaker constructor must be wrapped by a stronger system to restore required
guarantees, and the stronger system can directly construct the same semantic
object, prefer fusion.

Formal rule:

```text
c_strong = Wrap(c_weak)
∧ Γ(c_weak) ⊂ Γ(c_strong)
⇒ InvalidByDefault(c_weak)
```

If the stronger constructor can directly realize the same semantic object,
prefer:

```text
Fuse(c_strong, c_weak) = direct strong construction with no weaker intermediate
```

Interpretation:

- a weaker inner constructor that requires a stronger outer repair is a
  **repair-requiring intermediate**
- a repair-requiring intermediate is presumptively redundant unless it exposes a
  canonical boundary unavailable in the stronger substrate
- if the stronger system can directly construct the object, the weaker
  intermediate should be fused away

Declared capability acquisition is preferred over positional dependency passing
for runtime-owned semantic objects:

```text
DeclaredCapabilityAcquisition ≻ PositionalDependencyPassing
```

because positional passing may hide dependencies, weaken graph visibility, and
collapse environment semantics into mere value supply.

### Example: alternate constructor where constructor authority already exists

If the repository already constructs a semantic object through a scoped layer,
runtime-managed provider, or VM/runtime key, a sync constructor such as:

```ts
function createThing(deps): { thing, dispose }
```

is presumptively wrong unless it is semantically inert.

Why:

- it duplicates constructor authority
- it collapses environment modeling into parameter passing
- it often weakens lifetime/cancellation/finalization semantics
- it may eagerize a lazy or demand-driven construction model
- it adds an unnecessary moving part
- if it must later be wrapped by a stronger constructor, it is likely a
  repair-requiring intermediate rather than a justified boundary

### Example: helper addition when composition already suffices

If testing or constructing a subsystem can be expressed by composing the same
lawful primitives used in production, a bespoke helper surface is presumptively
unnecessary.

Example shape:

- production composition already builds an RPC/service world by composing layers
- a proposed `makeWorldRpcTestHelper(...)` adds a second path to the same result
- the helper adds no new guarantee and exposes no canonical boundary

This is pure indirection unless it materially reduces non-local proof burden or
exposes a missing canonical test boundary.

---

## Algebra Extraction Report

For refactors, shared-system work, architectural cleanup, public-surface changes,
and semantic bugfixes, the first substantive step is to produce an **algebra
extraction report**.

Persist it. Do not leave it floating in chat.

Location:

```text
.context/explorations/YYYY-MM-DD-<subsystem>-algebra-extraction.md
```

The report must include sufficient citations and evidence to justify its claims.
Do not write free-floating algebra claims with no textual or executable basis.
The report must include:

### 1. Scope
- subsystem
- question
- files/docs/tests read

### 2. Epistemic basis
For each material claim:
- proposition
- status: proved / cited / inferred / suspected
- doctrine sources
- public contracts/types
- canonical tests/examples
- implementation evidence
- conflicts or ambiguities

### 3. Host algebra recovery
For each central dependency:
- public surface
- canonical tests/examples
- carrier / constructors / destructors / combinators
- lifetime semantics
- failure semantics
- current local usage
- under-realization or bypass
- unexplored public API surface that may already solve the local problem

### 4. Constructor authority inventory
For each central semantic object:
- authoritative constructor
- why it is authoritative
- lawful environment model
- instantiation semantics
- lifetime owner
- memoization / laziness / sharing semantics
- alternate constructor surfaces found
- whether alternates are semantically inert
- violations or risks

### 5. Local ontology
- capabilities
- authoritative services
- sources of truth
- lifecycle owners
- public boundaries
- suspected hidden substrates

### 6. Local guarantees
- safety
- liveness
- ownership
- boundary
- observational
- temporal

### 7. Local algebras
- composition algebra
- lifetime algebra
- failure algebra
- ownership algebra
- boundary algebra

### 8. Witness classification
- lawful witnesses
- partial witnesses
- residue
- counterexamples
- missing witnesses

### 9. Necessary improvements
- missing representation needed to complete the algebra
- unnecessary surface that should be deleted
- guarantees currently smuggled and needing explicit representation
- host algebra features currently bypassed
- alternate constructors or helpers that are strictly dominated by existing composition

### 10. Proposed minimal surface
- what is necessary
- what is sufficient
- what composes
- what should not be added
- what code should read as pure domain logic after unnecessary scaffolding is removed

---

## Output Contract

When using this skill, provide or persist:

1. **epistemology**
   - what sources are authoritative
   - where doctrine and implementation diverge

2. **host algebra**
   - what the underlying libraries/tooling actually make possible

3. **constructor authority**
   - authoritative constructors
   - lawful environment models
   - whether any alternate constructors are admissible

4. **local ontology**
   - capabilities
   - authoritative services
   - boundaries
   - lifecycle owners
   - sources of truth

5. **guarantees**
   - stated propositionally

6. **algebras**
   - carriers
   - primitive vs derived operations
   - identities / zeroes where applicable
   - closure / composition properties

7. **classification**
   - witness / partial witness / residue / counterexample / missing witness

8. **minimal necessary-and-sufficient move**
   - preserve
   - sharpen
   - make explicit
   - delete
   - verify

## Humility Rule

When the subsystem relies on a library, runtime, or tool, begin from ignorance,
not confidence.

Necessary stance:

- do not assume you know how the dependency works
- do not project generic prior patterns onto the local dependency
- do not claim a semantic law until you can cite doctrine, public surface, or
  canonical tests
- if a claim matters architecturally, prefer proof by citation, type, or test
  over analogy

Compact rule:

> Assumptions are weak evidence. Proofs are strong evidence.
