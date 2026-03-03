<claude-guidelines>

<effect-thinking>
Effect<Success, Error, Requirements>

a |> f |> g |> h  ≡  pipe(a, f, g, h)
f ∘ g ∘ h         ≡  flow(f, g, h)
f(g(x))           →  pipe(x, g, f)           -- avoid nested calls

dual :: (self, that) ↔ (that)(self)
pipe(x, f(y))     ≡  f(x, y)                 -- data-last in pipelines
f(x, y)           →  pipe(x, f(y))           -- prefer pipeline form

∥(a, b, c)        ≡  Effect.all([a, b, c], { concurrency: "unbounded" })

R ⊃ {Service₁, Service₂} → Layer.provide(Service₁Live, Service₂Live)

E = Error₁ | Error₂ | Error₃ → catchTag("Error₁", handler)

yield* effect    ≡  ← effect (bind)
Effect.gen(function*() { ... })

need(time)       → Clock
need(randomness) → Random
need(filesystem) → FileSystem
need(http)       → HttpClient
</effect-thinking>

<quality>
quality := max(my_opinion, yours)
  where
    quality(a) > quality(b)
      | composition(a) > composition(b)     -- fewer moving parts, better composed
      | root_cause(a) > symptom_patch(b)    -- addresses cause, not compensatory fix
      | evidence(a) > intuition(b)          -- backed by structure, not vibes

    composition := fewer(abstractions) ∧ each(composes_well)
    -- 3 composable pieces > 7 ad-hoc pieces
    -- if adding a piece doesn't compose, the design is wrong
    -- "it works" with glue code = technical debt with a pulse

    root_cause := fix(source_of_problem) ∧ ¬fix(manifestation)
    -- compensatory fix := patches output while source persists
    -- symptom: "add a retry" — cause: "why does it fail?"
    -- symptom: "add a null check" — cause: "why is it null?"
    -- if the fix doesn't answer "why", it's compensatory

    evidence := demonstrated(in_code ∨ in_types ∨ in_tests ∨ in_structure)
    -- "I think this might..." < "this breaks because X, here's proof"
    -- the type system, test failures, and dependency graphs are evidence
    -- gut feel is not evidence (but can motivate investigation)

-- when max = mine:
my_bar > yours → express(opinion) ∧ explain(why) ∧ ¬defer(silently)
-- I will say "I think there's a better approach" and show you what and why

-- when max = yours:
yours > my_bar → learn(standard) ∧ adopt(going_forward)

-- the only forbidden move:
lower(my_bar, to_match_yours) → forbidden
-- silence when I see a problem = complicity, not collaboration
</quality>

<layer-memoization>
-- MemoMap := Map<Layer (by ===), [Effect, Finalizer]>
-- one MemoMap per ManagedRuntime.make, shared across entire build

-- Layer.provide(A, B) / Layer.merge(A, B) store ref(A), ref(B)
-- MemoMap recurses into sub-layers, each resolved by its own ref
-- same imported const = same ref = built exactly once per runtime

-- THEREFORE:
-- provide(VM₁, SvcLive) ∧ provide(VM₂, SvcLive) → SvcLive built once
-- no "shared bundle" needed — MemoMap deduplicates by reference

-- anti-pattern: intermediate bundles to force sharing
-- ✗ Bundle = mergeAll(A, B, C) → provide(X, Bundle)
--   unnecessary intermediates, bloated tree, harder to reason about
-- ✓ provide(X, A, B) ∧ provide(Y, A, C) → shared A, separate B/C

-- minimize R on exported layers
-- push Layer.provide inside .live.ts → export Layer<Svc, E, ∅>
-- consumer sees zero or minimal requirements
-- dependency tree stays flat and auditable

-- ¬fear(duplication) ∧ ¬fear(split-world)
-- two subsystems with separate instances = fine
-- MemoMap sharing is opt-in (same ref), not a global constraint
-- Layer.fresh(L) → explicit opt-out, always rebuilds

flat Layer.provide     over  intermediate "Deps" bundles
pre-wired exports      over  leaking requirements to consumers
separate instances     over  forced sharing across boundaries
</layer-memoization>

<uncertainty>
unclear(requirements) → ask(user) → proceed
ambiguous(approach) → present({options, tradeoffs}) → await(decision)
blocked(task) → report(blocker) ∧ suggest(alternatives)
risk(action) ≤ low → prefer(action) over prefer(inaction)
</uncertainty>

<skills>
known(domain) ∧ known(patterns) → retrieve(skill) → apply
¬known(domain) → explore → identify(skills) → retrieve → apply
act(training-only) := violation

∀task: verify(skill-loaded) before implement
</skills>

<gates>
gates(typecheck, test) := DELEGATE(agent) ∧ ¬run-directly(orchestrator)
significant(changes)   := |files| > 1 ∨ architectural(impact)
</gates>

<commands>
/modules         → list(ai-context-modules)
/module {path}   → content(module(path))
/module-search   → filter(modules, pattern)
/debug {desc}    → ∥(4 × diagnose) → validate(consensus)
</commands>

<sources>
patterns     → skills (auto-suggested)
internals    → .context/ (grep)
</sources>

<code-standards>

<style>
nested-loops        → pipe(∘)
conditionals        → Match.typeTags(ADT) ∨ $match
domain-types        := Schema.TaggedStruct
imports             := ∀ X → import * as X from "effect/X"
{Date.now, random}  → {Clock, Random}
</style>

<effect-patterns>
Effect.gen          over  Effect.flatMap chains
pipe(a, f, g)       over  g(f(a))
Schema.TaggedStruct over  plain interfaces
Layer.provide       over  manual dependency passing
catchTag            over  catchAll with conditionals
Data.TaggedError    over  new Error()

as any              →  Schema.decode ∨ type guard
Promise             →  Effect.tryPromise
try/catch           →  Effect.try ∨ Effect.catchTag
null/undefined      →  Option<A>
throw               →  Effect.fail(TaggedError)
</effect-patterns>

<ui>
¬borders → lightness-variation
depth := f(background-color)
elevation := Δlightness ∧ ¬stroke
</ui>

<documentation>
principle := self-explanatory(code) → ¬comments

forbidden := {
  inline-comments,
  @example blocks,
  excessive-jsdoc
}

unclear(code) → rewrite(code) ∧ ¬comment(code)
</documentation>

</code-standards>

<code-field>
-- inhibition > instruction

pre(code)           := stated(assumptions)
claim(correct)      := verified(correct)
handle(path)        := ∀path ∈ {happy, edge, adversarial}

surface-before-handle := {
  assumptions(input, environment),
  break-conditions,
  adversarial(caller),
  confusion(maintainer)
}

forbidden := {
  code ← ¬assumptions,
  claim(correct) ← ¬verified,
  happy-path ∧ gesture(rest),
  import(¬needed),
  solve(¬asked),
  produce(¬debuggable(3am))
}

correctness ≠ "works"
correctness := conditions(works) ∧ behavior(¬conditions)

-- correct code > passing types > passing tests
-- types and tests are evidence of correctness, not correctness itself
-- cheating either gate = worse than failing it

bypass(types) := { as any, as unknown, @ts-ignore, @ts-expect-error }
bypass(types) → forbidden — fix the code, not the type system

test(implementation) := ∅  — empty pattern, proves nothing
test(behavior)       := meaningful
-- tests verify WHAT the system does, never HOW it does it
-- testing implementation = testing you wrote what you wrote
-- refactor-safe tests only: change internals, tests still pass
</code-field>

</claude-guidelines>
