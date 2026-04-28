---
name: invariant-driven-design
description: The mandatory mental model for ALL feature development. Climb a ladder of documents — problem statement, laws, entities, interfaces, tests, code — where each rung satisfies the sufficient-and-necessary minimum demanded by the rung above, expressed in algebra, not prose. Laws are formulae; entities are algebraic objects; tests are property witnesses; code is a quantified-minimum discharge of proof obligations. Produces a folder of numbered documents with mathematical rigor; other skills (lawful-systems-engineering, semantic-hard-cut-refactor, domain-modeling, effect-testing) are specialized tools that assist specific rungs.
---

# Invariant-Driven Design

## This is the mandatory mental model

This skill is not an option. It is not a technique for difficult cases. **It is the only accepted approach for writing code that is part of a feature.** Every feature — every decision to build something new, to extend something existing, to change a contract — climbs this ladder. There is no other way.

If you are making a decision about what to build, you must understand what you are building **with mathematical precision** before you write a line of code. Anything else is ramble-code: typing for the sake of typing, guessing at shapes, hoping the test suite catches the wrongness. That is not engineering; that is churn.

The deliverable of engineering is not code. Code is the byproduct. The deliverable is **a defensible chain of reasoning from user observation to implementation, at every level sufficient and necessary for the level above, expressed in algebra wherever algebra applies.** The ladder is that chain. Without it, you do not know what you are building; you are only describing its surface.

**The ladder builds; it does not destroy.** New code lives alongside old code. Old code is preserved for reference and inspiration — it is the witness the algebra was recovered from, and it remains usable until a deliberate, separate decision retires it. Removal of any existing surface is a later choice, taken by the user or in a later cycle, never an automatic consequence of climbing this ladder.

The signature of good work under this skill is that someone literate in the relevant literature can read your ladder, recognize every named structure, and either verify each law's proof obligations locally or name the reference that discharges them.

Skip rungs and you are no longer doing invariant-driven design. You are merely typing characters that happen to compile. Do not. Paraphrase what a law states in prose and you have weakened it; write the law as a formula or cite the formula you are implementing.

---

## The algebraic minimum

Every document produced under this skill is held to algebraic standards:

- **Identify the named structure.** If the thing you are building is a monoid, call it a monoid. If it is a catamorphism over an ancestry DAG, say so. If it is a free-monoid action `α : List[Op] → End(State)`, write that signature. Named structures bring their laws for free; unnamed structures burden you with deriving them.
- **Prefer formulae to prose.** "Appending an event extends the history" is prose. `H' = H ++ [e] ⇒ σ(H') = δ(σ(H), e)` is a formula. Use the formula. The formula is checkable; the prose is vibes.
- **Use established notation.** `∀`, `∃`, `⇒`, `⇔`, `∧`, `∨`, `¬`, `⊆`, `⊂`, function arrows (`→`), composition (`∘`), product (`×`), sum (`+`), injections (`inl`, `inr`), catamorphism (`cata` or `fold`), anamorphism (`ana` or `unfold`). Do not reinvent syntax.
- **Cite section numbers.** Miller 2006 §9.2.5 is a citation; "Miller's thesis" is a gesture. Lamport 1978 "Time, Clocks" is the paper; "ordering events" is a vibe. If the literature speaks to your law, quote it precisely.
- **Explicit non-claims.** State what you are NOT proving. A bounded proof obligation is the honest one.
- **Canonical example.** Every non-trivial ladder has ONE end-to-end scenario that exercises every law in a single narrative. Without it, the laws are abstract; with it, the laws are experienced.
- **Purity first.** If a function can be pure — no Effect wrapping, no state mutation, no network — it MUST be. `merge(from, into) : MergeResult`, not `Effect<MergeResult>`. Effects are earned by need, not sprayed by default. When a module is pure, the header declares it ("NO state mutation anywhere") so the property is part of the contract, not an accident.
- **Mathematical variable names for algebraic entities.** `C`, `σ`, `δ`, `μ`, `ρ` at the algebra's level of abstraction. Short because the surrounding comment and the algebra already name them. Long, descriptive names for business-level identifiers. Do not use `conflictResolutionGroupCollection` where `groups` will do.
- **Counter-references on brownfield.** When your new code coexists with older code that the audit classified as residue or counterexample, cite the old `path:line` and state what the new code learns from or improves upon. The comparison is the lesson the reader carries forward; it is not a deletion notice. The old code remains as reference and inspiration.

---

## The ladder

Each rung is a document in a shared folder. Documents are numbered `00-`, `01-`, … so traversal order is obvious. Each rung implements ONLY what the rung above requires — **sufficient and necessary**, not more.

### 00 — Problem statement

*What is the application trying to do, observably?*

- Written in the user's language. No mechanism. No technology. No implementation vocabulary.
- Describes goals in terms of observable outcomes.
- Includes non-goals (what the system is explicitly NOT trying to do).
- Enumerates the *contexts* the system must work in (offline, multi-device, after crash, under load, under latency).
- If you find yourself writing "we use JWTs" or "the server will ...", you are in the wrong document.

The output: a reader understands what the thing does from the user's point of view, with no hints about how.

### 00b — Audit (brownfield only)

*What does the existing code already witness, what is rot, and where precisely?*

Skip this rung on greenfield. On brownfield:

- Invoke `lawful-systems-engineering`.
- For every load-bearing file in the current implementation, cite `path:line` and classify the region as:
  - **Lawful witness** — realizes the algebra cleanly.
  - **Partial witness** — realizes part of the algebra; identify what is missing.
  - **Residue** — reflects an older ontology; identify it.
  - **Counterexample** — violates the intended algebra; identify which law.
  - **Missing witness** — the semantics are clearly needed but not represented.
- For each rot artifact found, diagnose it as a symptom of a specific missing primitive or violated law. "Ambient `WeakMap` authority channel" is a specific Miller §9.2.5 violation; say so.

**Audit semantics — diagnostic, not destructive.** These classifications describe the existing code's RELATIONSHIP to the new law set. They do NOT prescribe deletion. A "counterexample" or "residue" label names what does not realize the new algebra; it does not mark the region for removal. Removal of any classified region is a SEPARATE later decision, taken after the new code is built, tested, and proven. The audit informs Rung 02 of what semantics the new shape must cover; it does not direct Rung 05 to destroy anything.

The output: a file-by-file map of where the existing code is lawful vs where it is not, with each non-lawful piece named by which upcoming law it relates to or which missing primitive would discharge it.

### 01 — Laws and properties

*What must hold for the problem statement to be satisfied?*

- Enumerated invariants, each with a name and **a formula, not a paragraph**. The paragraph is the motivation; the formula is the law.

  ```
  L-LAW-NAME
      ∀ x. P(x) ⇒ Q(x)
  ```

- Each law has:
  - **Statement** — the formula.
  - **Motivation** — one paragraph on why the law exists and what failure mode it prevents if the law is broken.
  - **Citation** — a specific paper / thesis / RFC / spec / established system's documented behavior, with section number where applicable.
  - **Classification** — safety (bad things don't happen) vs liveness (good things eventually happen); universal vs context-local.
  - **Proof obligation** — what would have to be shown to certify the law holds in an implementation.

- **Identify the named structures.** If the laws form a monoid, a functor, a monad, a CRDT, a state machine, a total order, a partial order, a lattice, a category — name it. Bring the structure's established laws in by reference; do not re-derive.

- **Include explicit non-claims.** A section beginning "We are not trying to prove…" that bounds the proof obligation. This is the difference between an honest ladder and a hand-wave.

- **Prior art must exist for non-trivial laws.** If a law lacks a citation after reasonable search, it is flagged "genuinely novel" — which is rare and suspicious. Usually you are rediscovering a named principle.

### 01b — Proof obligations and witness techniques

*For each law, what is the provably correct way to demonstrate it holds? Induction is one tool; the law tells you which tool.*

The law shape dictates the proof technique. Induction is the right tool for recursive / inductive data (event logs, trees, stacks). It is the wrong tool for algebraic identities (associativity, commutativity, identity), pointwise properties (determinism, idempotence), partition correctness (disjoint-union properties), and many others.

Enumerate, for each law in Rung 01, the appropriate witness technique. Typical mapping:

| Law shape                             | Witness technique                                                     |
|---------------------------------------|-----------------------------------------------------------------------|
| Algebraic identity (`f(f(x)) = f(x)`) | Pointwise property test over sampled inputs                           |
| Associativity                         | Three-element property test — fast-check `fc.tuple(x,y,z)` sampling   |
| Commutativity                         | Two-element property test                                             |
| Identity element                      | Two-sided property test vs generator                                  |
| Determinism                           | Same-input-twice equality                                             |
| Idempotence                           | Apply twice, compare equality                                         |
| Monotonicity / preservation           | Property test: extension preserves base                               |
| Partition / disjoint union            | Exhaustive case coverage over sampled partitions                      |
| Total-order invariants                | Sampled permutation, check anti-symmetry + transitivity               |
| Confluence (diamond property)         | Sampled pair of divergent paths, check convergence                    |
| Catamorphism fusion                   | Property test: `cata ∘ ana = hylo` over generators                    |
| Recursive structural property         | **Induction** (base + inductive step + conclusion)                    |
| Liveness under failure                | Bounded-time test with fault injection                                |
| Capability-discipline violation       | Static check + type-system encoding + grep audit                      |
| Protocol step correctness             | Simulation relation (refinement proof shape)                          |

Each Rung 01 law gets a one-line entry: "witnessed by {technique}, sampled over {generator}, in test `04-tests/<name>.test.ts::<name>`."

For systems with deeply recursive data (event logs, stacks, DAGs of accepted snapshots), an overall **induction proof of mutual consistency** may still be warranted — but only because the structure is recursive, not because "induction is how you prove things." Base case + inductive step + conclusion, each step naming the laws it invokes.

The deliverable of 01b is the mapping from law to witness technique. Rung 04 executes the techniques.

### 02 — Domain entities

*What are the things in our specific domain that MUST exist to realize the laws?*

- Named entities with one-paragraph descriptions.
- Each entity justified by **one or more specific laws from Rung 01**. An entity with no law is residue.
- Each attribute justified by a specific law.
- **Algebraic relationships between entities.** Say "an Intent is a `(Payload, Origin, Footprint)` triple — Payload is a product, Origin is a sum (`Acc | StackRef`), Footprint is a pair of finite sets." Don't just list fields.
- Entities adapt established patterns (from Rung 01's citations) to the specific shape of this codebase — its primitives, its constraints, its neighbours.
- Explicitly mark each entity as *new* / *extends existing* / *renames existing* / *supersedes existing (old preserved)*.

If the brownfield audit (Rung 00b) identified existing entities, explicitly state whether each survives, is renamed, is merged with a new entity, or is superseded for the new path (with the old preserved as reference). The new entity model describes the shape the new code realizes; it does not prescribe deletion of the old.

Invoke `domain-modeling` for Effect Schema / Data.TaggedEnum expression.

The output: the minimum set of concepts the implementation must represent. No more. No fewer. Each traced to the law that forces it.

### 03 — Interfaces

*What is the minimal shape each entity and operation must expose?*

- Types and signatures in the target language's actual type system. Not pseudo-code.
- Each method has pre/post conditions mapped to **specific laws from Rung 01**.
- Show how entities compose — what gets passed to what, what boundaries look like.
- **Explicitly state what is NOT in the interface** (capability constraints). "This interface does not expose `getInternal` — the internal state has no external witness."
- Use typed-error channels (invoke `error-handling`) where failure modes are tagged.
- The R-channel (required services) for each operation is explicit.

The output: a contract that compiles (or nearly so) in the target language. A skeleton a compiler could check for self-consistency.

### 04 — Tests

*How do we witness each law?*

Tests have two shapes. Keep them strictly separate. The separation is not stylistic; it is a discipline that protects the algebra from becoming a bag of examples.

#### 04a — Law tests (`__tests__/laws/`)

**What they prove.** The laws from Rung 01 hold pointwise over the space the algebra is defined on.

- **One test file per law**, named after the law (`L4-conflict.test.ts`, `L5-staleness.test.ts`). The file's header cites the law's formula verbatim from Rung 01.
- **Property-based sampling** (`@effect/vitest` + `fc` or schema-driven generators). Not example-based. The test body generates arbitrary instances of the algebra's inputs and asserts the property.
- **Witness technique per Rung 01b.** If the law is associativity, the test uses a three-element generator. If it is determinism, the test calls the function twice on the same input. If it is partition correctness, the test samples candidates and checks disjointness. Pick the technique Rung 01b specified.
- **References only the Rung 03 interface.** Never internals. Refactor-safe invariant.
- **Names are algebraic.** `commute`, `associate`, `identity`, `confluence` — not `testMerge1`, `testMerge2`.
- **Law tests are narrow.** A law test does not walk through a business narrative; it witnesses one property across sampled inputs.

Invoke `effect-testing` or `effect-concurrency-testing` as appropriate.

#### 04b — Scenario tests (`__tests__/scenarios/`)

**What they prove.** Nothing. They are a pedagogical aid and a regression guard for specific business narratives that humans need to see concretely to trust.

- **One file per scenario**, named after the story (`lawyer-model-swap.test.ts`, `two-user-concurrent-merge.test.ts`). The file tells ONE story end-to-end.
- **Not sampled.** Concrete values. Numbered steps. The scenario IS the test.
- **May exercise many laws in composition.** A scenario is a composition of several laws across a narrative; it does not replace any individual law test.
- **Does not supplant a law test.** If a scenario is the only witness a property has, the property is not a law — either promote it to a law (with its own property test in `04a`) or demote it to a scenario-specific assertion.
- **Stay out of `04a`.** A scenario test never lives in `__tests__/laws/`. Mixing the two turns law tests into example dumps and scenario tests into untyped property dumps.

#### The never-mix rule

If a test is property-based over sampled inputs: it is a law test, it lives in `__tests__/laws/`, it has one law's name on it.

If a test walks through a specific narrative: it is a scenario test, it lives in `__tests__/scenarios/`, it has the story's name on it.

A file that does both is mis-classified. Split it. The algebra does not tolerate examples as substitutes for properties; humans do not intuit properties without scenarios. Serve both audiences, in their own rooms.

#### Shared demands across both shapes

- **Tests reference only the Rung 03 interface.** Never internals. This is the refactor-safe invariant.
- **Explicit non-tests.** A section listing what is NOT tested because it is NOT in the proof obligation. "We do not test performance under adversarial-network partitions." State it.
- **Tests are RED by default at this stage.** The code to satisfy them does not yet exist. This is the moment where the ladder meets the codebase.

The output: a failing `__tests__/laws/` suite that, once green, proves the laws hold; plus `__tests__/scenarios/` files that encode the business narratives users will recognize. This is also the stage at which typechecks occur. Tests must have green types without type hacking / casts. Types here give us the confidence we modeled the interfaces well enough to start the green phase for tests.

### 05 — Code

*The smallest implementation that passes Rung 04 tests.*

- **Quantified minimality.** State a target LoC. Count it. If your implementation is much larger than necessary, something at Rung 02/03 was too ambitious; climb back.
- **Every line traces to a test it helps pass.** If a line is not demanded by any Rung 04 test, it does not exist.
- **No speculative generality.** No "we might need this later." No abstractions that do not currently carry load.
- **Imports are concrete. Types are narrow.** Every identifier serves a law.
- **Purity defaults.** A function is pure unless impurity is earned. A module owns no state unless state-holding is its purpose. Effects are visible in the type, and absence of Effect in the type is a claim.
- **Code mirrors the algorithm's text.** If Rung 01 documents a numbered algorithm (e.g., §3.6 "Merge — pure function"), the function body is a step-for-step transcription with the step numbers in comments. The code does not invent structure; it realizes the structure the algebra already described.
- If the implementation feels too simple, that is correct. The laws do the heavy lifting; the code is the witness.

#### File header contract (mandatory on every non-trivial module)

Every module under this skill opens with a header block. The header IS the contract; the code is the discharge. Template:

```ts
/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  ONTOLOGY ─ <ModuleName>
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * STATUS      <phase marker if staged>
 *
 * PURPOSE     <one paragraph in precise plain English — what this module is>
 *
 * ENTITIES INTRODUCED
 *   <name>      <shape — product/sum/brand>    <what it carries>
 *   ...
 *
 * INVARIANTS
 *   • <invariant 1 — stated precisely>
 *   • <invariant 2>
 *   • NO <explicit forbidden behavior>
 *
 * EQUALITY    <how equality is determined; structural? reference? tag+keys?>
 *
 * HASH/EQUAL INVARIANT
 *   <if the module's outputs appear as Atom values or Map keys, state the
 *    Hash/Equal requirements and which Effect primitives satisfy them>
 *
 * LIFETIME    <value | function | actor | service>
 *
 * LAW WITNESS
 *   L<id>  <short name>   <which arm / type / method witnesses it>
 *   ...
 *
 * DESIGN REFERENCES
 *   DESIGN.md §<n>   <section title>
 *   ...
 *
 * PAPER REFERENCES
 *   <Author Year, "Title">
 *     ─ <specific concept this module draws from, § or page number>
 *
 * COUNTER-REFERENCES (only when replacing existing code)
 *   <old file:line>
 *     <what was wrong; what this module replaces it with>
 *
 * DEPENDS ON            <list the module files>
 * DEPENDED ON BY        <list the callers>
 *
 * OPEN QUESTIONS
 *   • <specific deferred decision with phase marker>
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
```

The header is not documentation in the casual sense. It is a **contract** that the reader can check against the implementation below. A module with a complete header and minimal code is self-evidently correct at a glance — every invariant is named, every law witnessed, every reference cited. The reverse — code without the header — is an archaeological puzzle.

A good ratio of header to body is close to 1:1 for small algebraic modules. The code body below the header is a literal transcription of the algorithm the header declares — if §3 of the design doc gave a seven-step partition procedure, the function body has seven blocks with step-number comments tracing them. Body shorter than header is a sign that the algebra is simple and the contract is the actual work; body much longer than header is a sign that code is doing algebra the header did not declare, which usually means the algebra was smuggled into the implementation.

#### Function-level commentary

Every non-trivial helper carries a comment that names the algebraic choice, not the mechanics. "Transitive conflict-closure as a fold" is an algebraic comment; "iterates over candidates and groups them" is mechanical. Prefer algebraic.

#### Additive execution (default)

Rung 05 builds the new implementation **alongside** the old. The new code lives in NEW files (or new exports of existing files); the old code is unchanged. The Rung 04 test suite validates the new code. Once GREEN, Rung 05 is complete. The old code is retained — it remains usable, importable, and serves as reference for the algebra recovery the new code embodies. Retirement of the old surface is a SEPARATE later decision (taken by the user, or in a later cycle), not the responsibility of this ladder.

If a particular case requires destructive replacement during Rung 05 itself — rare, typically only when old and new cannot semantically coexist due to wire-protocol identity or another structural reason — invoke the optional `semantic-hard-cut-refactor` skill explicitly. By default, Rung 05 is additive.

The output: working code. Small. Obvious. Hard to misuse. Passes every Rung 04 test. The proof that the ladder did its work is the Rung 04 suite GREEN against the new code. LoC count of the new code is reported in the header or commit message. The old code's LoC is irrelevant to that proof and is not part of the deliverable.

### 06 — Canonical scenarios (mandatory if laws ≥ 8)

*End-to-end narratives that exercise the laws in composition. They live both as prose in the ladder folder and as green tests in `__tests__/scenarios/`.*

A canonical scenario is a named narrative — "the lawyer scenario," "the two-user merge," "the external-collaborator share" — that a human can hold in their head. It exists because the algebra alone is too abstract for intuition. The scenario names the narrative; the narrative walks through each step; each step cites which law governs the transition.

Format:

1. Setup — initial state, entities, roles.
2. Action 1 — what happens, which law governs, what the algebra predicts.
3. Action 2 — a concurrent or escalating event, next law.
4. Continuation — through to the final state.
5. Final state, expressed in the entity vocabulary.

Place:

- In the ladder folder: `06-canonical-scenarios.md`, one prose narrative per scenario.
- In `__tests__/scenarios/`: one test file per scenario, enforcing the narrative in code.

A scenario is a regression guard and a teaching tool. It is NOT a substitute for law tests. If the scenario is the only place a property is asserted, the property either deserves promotion to a law (with its own Rung 04a test) or was not a property to begin with.

---

## The discipline

### Sufficient and necessary

Each rung implements exactly what the prior rung demands. Rung 02 introduces no entity whose existence isn't forced by a Rung 01 law. Rung 05 writes no line of code not demanded by a Rung 04 test. This is the whole game. Code is lean because every rung squeezes.

### Re-entry

If a rung changes, re-examine all downstream rungs. Adding a law is cheap; it ripples. Removing a law is cheaper; often whole entities / interfaces / tests / code lines disappear. This is a feature.

### No forward references

No rung may justify itself by appealing to rungs below it. Laws are justified by the problem statement, entities by laws, interfaces by entities, tests by laws-via-interfaces, code by tests. Arrows point one way.

### Algebra before engineering

When faced with a design choice, ask: does an algebraic structure compel the answer? If yes, use the structure. ("The fold is a monoid homomorphism → append then fold equals fold then append the suffix.") If no, proceed to engineering choice. The asymmetry matters: algebra is universal; engineering is local.

### Documents, not diagrams

Each rung is a markdown document. Folder structure:

```
<subsystem-name>/
  00-problem-statement.md
  00b-audit.md               (brownfield only)
  01-laws.md
  01b-proof.md               (if ≥ 8 laws or recursive structure)
  02-entities.md
  03-interfaces.md
  04-tests.md                (or tests/ — links to actual test files)
  05-code.md                 (or a pointer to where the code lives)
  06-canonical-example.md    (if ≥ 8 laws)
```

Diagrams are welcome embedded in the documents; they don't replace prose, and prose doesn't replace formulae.

---

## How other skills plug into specific rungs

### `lawful-systems-engineering` → Rung 00b + seeds Rung 01/02 for brownfield

Recovery procedure for existing algebra. Reads public surface, canonical tests, doctrine, and implementation in that order, classifies each part as lawful-witness / partial-witness / residue / counterexample / missing-witness, then distills the recovered laws. Use BEFORE writing Rung 01 on a brownfield subsystem. The classification directly seeds the 00b audit and informs which laws survive and what semantics the new shape at Rung 02 must cover. The classifications are diagnostic; they do not prescribe deletion of the old code.

### `semantic-hard-cut-refactor` → Rung 05, OPTIONAL, only when additive coexistence is structurally impossible

The default at Rung 05 is **additive**: new code is built alongside old code, validated by Rung 04 tests, and ships GREEN with the old code untouched. `semantic-hard-cut-refactor` is reserved for the rare case where old and new genuinely cannot coexist — typically a wire-protocol identity or a shared on-disk format the new shape must claim atomically. Invoke it explicitly when that condition holds; otherwise, do not invoke it. Retirement of the old surface is a SEPARATE later decision, not a default Rung-05 step.

### `domain-modeling` → Rung 02

Rung 02 is where algebraic patterns (Rung 01's citations) meet our codebase (Schema, tagged ADTs, typeclass instances). Invoke when you reach Rung 02 and need to turn "`MembershipGrant` is a signed event parameterized by role and scope" into a concrete `Schema.TaggedStruct`.

### `effect-testing` + `effect-concurrency-testing` → Rung 04

Rung 04's tests are property-based and actor-driven. `effect-testing` provides `makeTestKit`, `Actor.group`, `it.live`, property generators over Schemas. `effect-concurrency-testing` adds Fiber / Deferred / Latch / Stream primitives for liveness laws.

### `error-handling` → Rung 03

Typed-error channels on interface methods. Every failure mode is a `Data.TaggedError`; callers narrow with `catchTag`. The absence of typed errors at Rung 03 is a hole in the proof obligation.

### Others

- `schema-composition` → Rung 02/03 when entities need structural composition.
- `pattern-matching` → Rung 03/05 for ADT destructuring.
- `platform-abstraction` → Rung 02 when the entity boundary crosses browser/bun/test substrates.
- `wide-events` → Rung 04 when the law is observability (canonical log line per request).
- `ai-context-writer` → after Rung 05, documenting the settled module.

The ladder is the mandatory structure; these skills are the artisan's tools at specific steps.

---

## Anti-patterns that prove the ladder was skipped

- **Code appears, then tests are added to cover it.** Tests written after code test implementation, not laws. Red flag: the tests reference internal symbols, not the published interface.
- **An interface method no test exercises.** The interface is larger than the laws demand. Cut the method, or find the missing law.
- **A law has no citation.** Either find the reference (most likely) or prove genuine novelty (rare). "Because it seems right" is not a law.
- **A law stated only in prose, with no formula.** The formula is where rigor lives; the prose is motivation. Missing the formula = missing the rigor.
- **A module without a header contract.** The file's invariants, law witnesses, and references should be a comment block at the top. Code without this preamble is an archaeology puzzle for the next reader.
- **A pure function wrapped in Effect for no reason.** If the function does not produce an effect, it is not an Effect. The type is part of the contract; a spurious Effect is a lie.
- **State mutation in a module whose header declares purity.** Either the header is wrong or the code is. Find which, fix that one.
- **An entity introduced because "we usually have a Foo."** Analogy is not a justification; force from a Rung 01 law is.
- **Tech names in the problem statement.** JWT, HTTP, SQLite, Effect — none of these belong at Rung 00. Rewrite in user-observable language.
- **Rot diagnosed as bad code rather than missing primitive.** "This code is ugly" is not a diagnosis. "This code is a symptom of conflating the dispatch turn with the reactivity flush turn (Miller §13, plan interference)" is.
- **No canonical example.** The laws remain abstract. Write the one story.
- **A refactor with no counter-references.** When the new code coexists with older code the audit classified as residue or counterexample, cite the old `path:line` and say what the new code learns from or improves upon. The comparison teaches; the old code stays in place as reference.
- **"Proof by induction" used reflexively.** Induction is one witness technique. Pick the right one for each law's shape — identity, commutativity, determinism, partition correctness, confluence, simulation — each has its own discharge.
- **Law tests and scenario tests mixed in the same file.** A file that samples inputs and also tells a business story is both too abstract for humans and too concrete for the algebra. Split them. Law tests live in `__tests__/laws/`; scenario tests live in `__tests__/scenarios/`.
- **A scenario stands in for a law test.** If the only place a property is asserted is a scenario, it is not a law. Either promote it to a law with its own property test, or stop claiming the property as an invariant.
- **Core built to serve a speculated API.** Rung 02 entities exist because laws force them, not because an edge might want them. If an entity's justification starts with "the API will need…," it is residue from an unbuilt edge.
- **Accepting a user-specified API before the core is lawful.** The user's API may be their best guess, but a guess is not a specification. Build the core first; choose or negotiate the API at the edge.
- **"We'll clean this up later."** Later does not come. The ladder is how you avoid needing later.
- **Disagreement resolved at the code level.** If two contributors disagree about implementation shape, climb the ladder until the disagreement surfaces as a law dispute — which is where it actually lives.

---

## Output shape

When you finish a subsystem under this discipline, you leave behind:

1. A folder of 5–7 documents (Rung 00 through Rung 06 depending on complexity).
2. A test file (or small suite) that passes — with RED history demonstrable in the commit log.
3. Minimum new code that passes the tests, with LoC count reported. Existing old code is unchanged; it remains alongside the new code as reference. Retirement of the old surface, if it happens, is a separate later decision.
4. An audit trail: any reader can walk from problem → laws → entities → interfaces → tests → code, seeing at each step why this AND NOT MORE, and for each law seeing the formula, the citation, and the test that witnesses it.

That audit trail is the value. Code alone is not the deliverable; the ladder is.

---

## Invocation

Invoke at the start of:

- Any new feature.
- Any non-trivial extension (adds new entity, new law, new interface method).
- Any refactor whose correctness is not locally obvious.
- Any decision about "how should we do X?" — X cannot be decided without this ladder.

Do not invoke for:

- A character-level bugfix that changes no semantics.
- A mechanical rename or import reorganization.
- A comment edit.
- A dependency version bump.

If you are unsure whether a change requires this skill: it does. The cost of climbing the ladder for a small change is measured in minutes; the cost of not climbing for a change that deserved it compounds forever.

---

## Pure core, composed edge

A frequent failure mode of feature work is starting from the user's requested API and back-filling an implementation that barely holds together. This skill forbids that direction.

**Build the core algebra first, pure and tight.** No convenience concessions, no sugar, no "but the user wants it to look like X." Rungs 00 through 05 produce a core whose entities are algebraic objects, whose functions are pure, whose laws are witnessed, whose code is minimal.

**User-facing APIs come LAST**, as a composition at the edge. Once the core is lawful and small, you can expose it however the user finds ergonomic — a service, a DSL, a CLI, a REST surface, a SQL-like query language. The edge is a composition layer; it does no algebra itself.

This discipline has three consequences:

1. **The user's stated API is irrelevant until the core is done.** A user asking for "an endpoint that lists shares" before the grant algebra is settled is asking for shape without semantics. Build the semantics; the shape falls out or is chosen at the edge. If the user insists on the shape first, push back — an API premature to its core is a commitment to whatever confusion currently holds, cemented at the interface.
2. **The user may not know what they want until the core is built.** "I want X" often means "I want something that solves my problem, and I think X might" — and X, examined against a lawful core, often changes. Resist building for X when the core has not spoken.
3. **Multiple edges can cover the same core.** Once the core is pure, new user-facing surfaces are cheap additions, not redesigns. This is the reward for algebraic patience. Building the new core does not require removing an old one. They coexist; consumers choose which to depend on.

**Anti-pattern the skill forbids:** letting an assumed user-facing surface drive entity shape. If Rung 02 introduces an entity because "the API will need a `UserDTO`," that is residue from an unbuilt edge infecting the core. Do not include it in the new core. The core will grow a user-facing `User` representation when a specific edge requires one — and that edge can be built at any time once the core is stable.

---

## Don't build for the sake of having an API

When a user asks for a final API before the core is designed, their API is a **guess at what would solve their problem**. They are not wrong to have a guess — guesses orient. They are wrong if the guess becomes a constraint.

- If you are tempted to add an entity, an interface method, or a code path because "we'll need it for the user's API" — stop. Rung 02 introduces entities forced by laws, not by speculative edges.
- If the user says "I want X to look like Y" and Y is a shape the core does not naturally produce — ask why. Often the answer reveals that the core is wrong OR that Y is an artifact of their prior (pre-local-first, pre-capability, pre-federated) mental model.
- If the user cannot articulate the problem without reaching for an API, the problem statement is not yet complete. Climb back to Rung 00.

The right order is always: problem → laws → entities → interfaces → tests → code → expose through an edge. Never: API → fake up laws → hope the core holds.

---

## The meta-claim

Most architectural disagreement dissolves when the ladder is climbed honestly. Disagreement at Rung 05 (code shape) usually traces to ambiguity at Rung 01 (laws). Forcing the ladder surfaces the real dispute at the level where it can be resolved — usually a missing law, occasionally a contested citation. Once the laws are agreed, the code nearly writes itself.

If you finish a ladder and the code still feels wrong, the ladder is broken somewhere above. Go find where. Do not paper over at Rung 05; the wrongness is not there.

The ladder is the minimum. Everything else is rambling.

---

## When in doubt

Ask: **"What formula am I about to violate, and which paper names it?"**

If you can answer, proceed. If you cannot, the rung above is missing something. Climb back.

---

## Amendment log

- **2026-04-25 — Additive-execution amendment.** Removed deletion-as-default-prescription. Rung 05 builds new code alongside old code; old code is preserved as reference and inspiration; retirement of the old surface is a separate later decision, not part of any single ladder. Rung 00b classifications (residue, counterexample) are diagnostic, not destructive. `semantic-hard-cut-refactor` becomes an OPTIONAL Rung-05 tool for the rare structurally-incompatible case (wire-protocol identity, shared on-disk format), not the default. See `.context/ladders/federated-store-app/` for the first ladder executed under this discipline.
