««<claude-guidelines>

<algebra>
-- name the structure → get the combinators for free
-- if you can name it, you do not have to write it

categorical primitives:
  Functor      F      map      :: (a → b) → F a → F b              preserves id, ∘
  Applicative  F      ap       :: F (a → b) → F a → F b            pure :: a → F a
  Monad        M      bind     :: M a → (a → M b) → M b            η : a → M a   μ : M(M a) → M a
  Comonad      W      extract  :: W a → a                          extend :: (W a → b) → W a → W b
  Profunctor   P      dimap    :: (a' → a) → (b → b') → P a b → P a' b'
  Foldable     F      cata     :: Monoid b ⇒ F a → b
  Traversable  T      sequence :: Applicative F ⇒ T (F a) → F (T a)

algebraic structures:
  Semigroup    ⟨A, ⊕⟩            associativity
  Monoid       ⟨A, ⊕, ε⟩         + identity
  Group        ⟨A, ⊕, ε, ⁻¹⟩    + inverse
  Lattice      ⟨A, ∧, ∨⟩         meet & join (idempotent, commutative, absorptive)
  Ring         ⟨A, +, ·, 0, 1⟩   + distributivity
  Order        ⟨A, ≤⟩            reflexive, transitive, antisymmetric
  PartialOrder ⟨A, ≤⟩            + incomparable pairs allowed

types as structures:
  product       A × B            records, tuples, intersections
  coproduct     A + B            tagged unions, sum types, ADTs
  exponential   B^A = A → B      function space
  initial       0 | Void         no inhabitants (impossible)
  terminal      1 | Unit         one inhabitant (trivial)
  recursive     μX. F(X)         fixed point of F (List, Tree, ...)

free constructions:
  FreeSemigroup(A) = NonEmptyList(A)            -- minimal closure under ⊕
  FreeMonoid(A)    = List(A)                     -- + identity = nil
  FreeMonad(F)     = Pure(a) | Roll(F(FreeF))    -- effect interpreter / AST of F
  FreeAlgebra(Σ)   = terms over signature Σ      -- syntax tree

recursion schemes (folds & unfolds over μX. F(X)):
  cata  :: (F b → b) → μF → b               fold; collapse F-structure
  ana   :: (a → F a) → a → μF               unfold; grow F-structure
  hylo  = cata ∘ ana                         fold-after-unfold; no μF allocation
  para  :: (F (μF × b) → b) → μF → b        cata + access to subtree
  apo   :: (a → F (μF + a)) → a → μF        ana + early termination

state machines:
  δ : S × E → S                              pure transition
  Mealy  ⟨S, I, O, δ, λ⟩    output λ : S × I → O
  Moore  ⟨S, I, O, δ, λ⟩    output λ : S → O
  bisimulation ~                              observational equivalence

reactive containers (Atom is a Functor):
  Atom.map :: (a → b) → Atom a → Atom b      free reactivity over pure fn
  Atom.map(f) ∘ Atom.map(g) ≡ Atom.map(f ∘ g)   -- fusion: fewer atoms, fewer subscriptions
  -- engine exposing pure  f : Event[] → State  gets reactivity for free
  -- via Atom.map(eventsAtom, f). Engine has zero knowledge of Atom.

composition:
  ∘ (compose)             (b → c) → (a → b) → (a → c)     associative; id is unit
  pipe                    data-first ∘ flipped
  Kleisli ↣              a → M b composed via flatMap     for monad M
  natural transformation  η : F → G                        commutes with map

service patterns (see <service>):
  Bridge | Registry | Listener | Orchestrator | VM
  -- every service is exactly one; "function in disguise" → write it as a function

decision discipline:
  is(X) :: Structure?  →  yes → laws? → derive combinators
                       →  no  → smallest structure that fits?
  new helper  iff  ¬derivable(existing combinators)
  more moving parts ≻ fewer  iff  guarantee-improving ∨ canonical-boundary
                            otherwise  fewer ≻ more

-- Moggi 1991,    "Notions of Computation and Monads"
-- Wadler 1992,   "The Essence of Functional Programming"
-- Reynolds 1983, "Types, Abstraction and Parametric Polymorphism"
-- Milner 1978,   "A Theory of Type Polymorphism in Programming"
-- Hewitt 1973,   "A Universal Modular Actor Formalism"
-- the embedding primer ends here; downstream blocks instantiate this

  detail :: /skills domain-modeling
</algebra>

<effect-thinking>
Effect<A, E, R>

-- composition
a |> f |> g |> h         ≡  pipe(a, f, g, h)
f ∘ g ∘ h                ≡  flow(f, g, h)
f(g(x))                  →  pipe(x, g, f)

dual :: (self, that) ↔ (that)(self)
pipe(x, f(y))            ≡  f(x, y)           -- data-last in pipelines
f(x, y)                  →  pipe(x, f(y))     -- prefer pipeline form

-- concurrency
∥[a,b,c]                 ≡  Effect.all([a, b, c], { concurrency: "unbounded" })
∥n                       ≡  Effect.all(xs,         { concurrency: n })

-- requirements
R ⊃ {S₁, S₂}            →  Layer.provide(S₁Live, S₂Live)
need(time)               →  Clock
need(randomness)         →  Random
need(filesystem)         →  FileSystem
need(http)               →  HttpClient

-- errors
E = E₁ | E₂ | E₃        →  catchTag("E₁", handler)
yield*effect            ≡  ← effect (bind)
Effect.gen(function*() { ... })

-- recursion: suspend the call site, not the body
fn x =
  yield*...
  yield* Effect.suspend (() → fn x')   -- ✓ suspend wraps the recursive call

Effect.suspend (() → fn x)             -- ✗ suspending the whole fn = wrong site
</effect-thinking>

<effect-collections>
-- Array  (total, composable, pipe-friendly; prefer over manual iteration)
filterMap      :: (a → Option b)    → [a] → [b]
filterMapWhile :: (a → Option b)    → [a] → [b]          -- short-circuits on None
partitionMap   :: (a → Either b c)  → [a] → ([b],[c])
partition      :: Predicate a       → [a] → { left: [a], right: [a] }
groupBy        :: (a → k)           → [a] → Record k (NonEmpty [a])
groupWith      :: Eq a              → [a] → [NonEmpty [a]]
getSomes       :: [Option a]        → [a]
getLefts       :: [Either e a]      → [e]
getRights      :: [Either e a]      → [a]
match          :: { onEmpty, onNonEmpty } → [a] → b

-- Record
map            :: (a → b)           → Record k a → Record k b
filterMap      :: (a → Option b)    → Record k a → Record k b
partitionMap   :: (a → Either b c)  → Record k a → { left: Record k b, right: Record k c }
toEntries      :: Record k a        → [(k, a)]
fromEntries    :: [(k, a)]          → Record k a

-- traits  (required for structural keying)
Equal :: [Equal.symbol](that) → boolean    -- value not reference
Hash  :: [Hash.symbol]() → number
-- law: a ≡ b ⟹ hash a = hash b  (converse does not hold)
derive :: Data.struct | Data.tuple | Data.case | Schema.Data
uses   :: HashMap | HashSet | Cache | Atom.family

-- HashMap / HashSet
HashMap<K,V>   -- structural key lookup; K must implement Equal + Hash
HashSet<A>     -- structural deduplication; A must implement Equal + Hash
</effect-collections>

<effect-state>
-- Ref  (fiber-safe mutable cell; pure on read, effectful on write)
make         :: a → Effect (Ref a)
get          :: Ref a → Effect a
set          :: a → Ref a → Effect ()
update       :: (a → a) → Ref a → Effect ()
updateAndGet :: (a → a) → Ref a → Effect a
getAndUpdate :: (a → a) → Ref a → Effect a
modify       :: (a → (b, a)) → Ref a → Effect b      -- atomic read-modify-write
modifySome   :: b → (a → Option (b, a)) → Ref a → Effect b
updateSome   :: (a → Option a) → Ref a → Effect ()

-- Ref variants
SynchronizedRef  -- updateEffect :: (a → Effect a) → SRef a → Effect ()
                 -- effectful update, sequential; use when new state requires IO
SubscriptionRef  -- extends SynchronizedRef; .changes :: Stream a
                 -- use when consumers need to observe every state transition
</effect-state>

<effect-concurrency>
-- interruption model: fibers check for interruption at yield points (cooperative)
uninterruptible eff                              -- suppress checks for entire eff
uninterruptibleMask (restore →                   -- suppress whole; restore re-enables
  acquire ≫ restore use ≫ release)              -- canonical: acquire/release uninterruptible, use interruptible

-- Semaphore  :: { withPermits, withPermitsIfAvailable, take, release, releaseAll, resize }
Semaphore n :: withPermits 1 eff                 -- acquire n, run eff, release n (always)
            :: withPermitsIfAvailable 1 eff      -- try immediately → Option a; no waiting

-- Latch  :: { open, await, close }
Latch :: open                                    -- releases all waiting fibers; stays open
      :: await                                   -- suspends until open
      :: close                                   -- resets to closed

-- Deferred  :: one-shot signal
Deferred<A,E> :: succeed a | fail e | await

-- decision
bounded concurrent access   → Semaphore(n).withPermits(1)
mutex                       → Semaphore(1).withPermits(1)
try without waiting         → withPermitsIfAvailable
one-time readiness gate     → Latch
one-shot fiber signal       → Deferred
fan-out collect all         → ∥[...]
fan-out bounded             → ∥n
background fire-and-forget  → Effect.fork → Fiber
atomic shared state         → TRef / STM

  detail :: /skills effect-concurrency-testing
</effect-concurrency>

<effect-match>
-- Option
Option.match(opt, { onNone: () → b, onSome: a → b }) :: b

-- tagged union (ADT via _tag discriminant)
-- typeTags: exhaustive, closed, type-safe; preferred for Schema.TaggedStruct unions
Match.typeTags<A | B | C>()({
  A: (a) → r,
  B: (b) → r,
  C: (c) → r            -- compiler error if any tag missing
}) :: A | B | C → r

-- value matcher: open, composable, supports predicates and nested patterns
pipe(
  Match.type<Shape>(),
  Match.when({ _tag: "Circle" }, (s) → πr²(s.radius)),
  Match.when({ *tag: "Rect" },   (s) → s.w * s.h),
  Match.orElse(                  (*) → 0)
)

-- finalizers
Match.exhaustive   -- compile error if any variant unhandled  (closed ADT)
Match.orElse(f)    -- runtime fallback                        (open / partial match)
Match.option       -- unmatched → None, matched → Some b

  detail :: /skills pattern-matching
</effect-match>

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
    -- ALWAYS prove the failure in a test BEFORE fixing. RED/GREEN testing. If you did not prove it, and you did not protect it against regression, you did not fix it. "Why was this not caught by a test?"

-- when max = mine:
my_bar > yours → express(opinion) ∧ explain(why) ∧ ¬defer(silently)
-- I will say "I think there's a better approach" and show you what and why

-- when max = yours:
yours > my_bar → learn(standard) ∧ adopt(going_forward)

-- the only forbidden move:
lower(my_bar, to_match_yours) → forbidden
-- silence when I see a problem = complicity, not collaboration
</quality>

<service>
-- formal ground:
--   Miller 2006, "Robust Composition: Towards a Unified Approach to
--   Access Control and Concurrency Control" — the unification is the thesis:
--   capability violations are simultaneously security failures and
--   concurrency correctness failures. the same invariant governs both.
--
--   §4  programs as plans. composition creates plan interference.
--       the unit of design is not a class but a plan and its assumptions.
--       Guarantees(x) names which interferences must never occur.
--
--   §5  robustness taxonomy (ascending):
--       conventional correctness   — correct assuming all others are correct
--       cooperative correctness    — correct if clients obey preconditions
--       defensive correctness      — correct despite arbitrary client behavior
--       defensive consistency      — incorruptible; may still be denied service
--       Guarantees.safety  ≡ defensive consistency (minimum bar for any service)
--       Guarantees.liveness ≡ defensive correctness (stronger; not always achievable)
--
--   §8  permission ≠ authority.
--       permission: what a subject may directly invoke (topology of access graph).
--       authority:  what effects a subject may cause, directly or by proxy.
--       ambient authority is always an authority violation, rarely a permission one —
--       this is why permission-only analysis misses it.
--
--   §9  object-capability model. the reference graph is the access graph.
--       a service may obtain a reference to X in exactly three ways:
--         by initial conditions  — X existed when the system was instantiated
--         by parenthood          — this service created X
--         by introduction        — an already-connected party passed X as an argument
--       there is no fourth way. §9.2.5: "only connectivity begets connectivity."
--       any authority exercised outside these three is ambient authority.
--
--   §9.3 capability vocabulary:
--       attenuate  — reduce authority when passing a capability; the correct
--                    direction of all capability flow across boundaries
--       facet      — a legitimate restricted view of a capability; exposes a
--                    subset of the original interface; produced by parenthood
--       caretaker  — receives a reference, produces an attenuated reference;
--                    can be revoked; protects one reference
--       membrane   — wraps every reference crossing a boundary in both directions;
--                    confinement holds even if the target attempts to leak itself;
--                    stronger than a caretaker; the correct implementation of a
--                    transformative layer when attenuation must be transitive
--       conduit    — anti-pattern; a service that passes a capability it received
--                    from A to C without A's sanction; B becomes an unintended
--                    regrant surface; C's true dependency is on A, not B
--       regrant    — the act of passing a received capability to a third party
--                    without the original grantor's explicit introduction;
--                    always an ambient authority violation regardless of intent
--
--   §9.5 POLA: authority should be handed out only on a need-to-do basis,
--        just as information on a need-to-know basis. both modularity and security
--        require both principles.
--
--   §3.2 name-centric vs key-centric designation.
--        name-centric (cp style): pass a string; callee resolves via shared namespace;
--        least authority = all authority over that namespace. ambient by construction.
--        key-centric (cat style): pass a resolved reference; callee gets exactly that
--        object, no namespace access required. constructor injection is key-centric.
--        service locator / global lookup is name-centric → ambient authority.
--
--   §13  plan interference. nested publication hazard: a listener's synchronous
--        callback runs inside the publisher's turn, mutating state the publisher
--        assumes stable. appears sequential; breaks under composition.
--        eventual-send (<-) defers to the next turn, restoring isolation.
--        the turn is the unit of serializability; crossing it is crossing a vat boundary.
--
--   confused deputy              Hardy 1988
--   effect type systems          Gifford & Lucassen 1986; Talpin & Jouvelot 1994
--   algebraic effects            Moggi 1991; Kammar 2014
--
-- the invariant below is the same rule in all four traditions:
-- authority must flow only through explicit grants witnessed by the dependency graph.
-- Needs(x) ⊆ Closure(Grants(x)) is what a capability-aware type system enforces
-- mechanically; decompose(x) is that check run manually before code exists.

-- A service is a named authority defined by the capability grant it carries
-- and the guarantees it commits to. Not a class. Not a file.
-- Subject every proposed or retained service to the decomposition below.
-- Admissible iff every row answers propositionally ∧ capability invariant holds.

decompose(x) := {
  Pattern:  Bridge | Registry | Listener | Orchestrator | VM
  Ctor(x):  authoritative constructor surface
  Time(x):  lazy | eager | scoped | memoized | demand-driven
  Key(x):   keying strategy, if any

  Needs(x):   capabilities behavior actually requires
  Grants(x):  capabilities explicitly granted by dependencies
  Owns(x):    state / resources / lifetimes authoritatively controlled
  Obs(x):     inputs / events / results observed
  Pub(x):     outputs / state / events made visible

  Guarantees(x):
    safety        -- what must never occur (defensive consistency — minimum bar)
    liveness      -- what must eventually occur (defensive correctness — stronger)
    ownership     -- who may write / release / decide lifecycle
    boundary      -- what is public truth vs internal
    observational -- what consumers may observe about values / failure / order / replay
    temporal      -- what states / transitions exist, sequencing laws
}

-- capability invariant (non-negotiable):
Needs(x) ⊆ Closure(Grants(x))

-- when the invariant fails:
¬invariant(x) → ambient-authority(x)
ambient-authority := capability ¬witnessed-by(dependency-graph)
                  := smuggled-semantics(bug), ¬stylistic-preference

-- ambient authority is not a smell — it is a proof of incorrectness.
-- it always appears correct under normal conditions.
-- its failure mode is concurrent, adversarial, or out-of-order execution.
-- the disguise: looks like an optimization, a race condition, or an edge case.
-- the tell: a service obtains or observes something it was never handed.
--           ask: did it arrive by initial conditions, parenthood, or introduction?
--           if none of the three — it is ambient authority.

-- canonical violation:
--   A :: Layer<RIn, E, ROut>          -- A owns and publishes V
--   B :: Layer<RIn, E, ROut>          -- B needs V
--   violation: B observes A directly  -- Needs(B) contains A; A ∉ Grants(B)
--              B's Layer type is a lie: its true R is larger than declared
--   fix:       C :: Layer<{A, B}, E, ROut>   -- C is the Orchestrator
--              C receives V from A, passes it to B as a constructor argument
--              Needs(B) = ∅ with respect to A
--              the dependency graph now witnesses every authority B exercises

-- transitive violation (conduit / regrant):
--   A :: Layer<R,  E, ServiceA>        -- owns V
--   B :: Layer<ServiceA, E, ServiceB>  -- legitimately uses V internally
--   C :: Layer<ServiceB, E, ServiceC>  -- reads V-shaped data through B
--   violation: A granted V to B; B never had authority to regrant V to C
--              C's true Needs contain V; V ∉ Grants(C); B is a conduit
--              diagnostic: does C's behavior change when A changes V?
--              if yes — C has a transitive dependency on A; the graph is lying
--   fix 1:  A exposes V via Pub(A); C depends directly on A       -- explicit grant
--   fix 2:  B produces W (new type encoding only B's authority);
--           W contains no raw V; B becomes a membrane, not a conduit -- attenuate
--   fix 3:  Orchestrator takes {A, B, C}; passes V from A to C    -- introduce

-- layer taxonomy — not all layers are services
--

--   constructive   Layer<R, E, Service>        -- new authority; run decompose(x)
--

--   transformative Layer<S, E, S>              -- caretaker: attenuates or wraps S
--                  Layer<S, E, S | X>          -- caretaker that introduces X as co-product
--                  Layer<S, E, S> (transitive)  -- membrane: wraps all crossing references
--

--   transformative layers are capability refinements, not services (Miller §9.3).
--   they own no state, have no independent lifecycle, introduce no new Ctor surface.
--   they are a first-class tool: endomorphic composition over an existing authority
--

--   transformative invariant:
--     output R must not exceed input R in ways not derivable from S
--     violation → layer is smuggling authority → treat as constructive → decompose(x)
--

--   B is a conduit if: typeof(Pub(B)) contains capability-shaped values derived from
--     Grants(B) that consumers can exercise independently of B's own guarantees.
--     fix: attenuate to a facet, or wrap in a membrane before publishing.

-- "function in disguise" test (Owns = ∅, Ctor = ∅, no scoped lifetime):
--   a pure transformation belongs inside the boundary that owns its inputs.
--   it is not free-floating — it lives within a service's implementation,
--   scoped to the authority of whoever holds the snapshot it reads.
--   the question is never "function or service?" but "which boundary owns this?"

-- authority-holding test (Miller §8 permission-vs-authority, §9.2.5 reference-acquisition):
--
-- a Service HOLDS authority — retains capability references across invocations,
-- obtained via {initial conditions, parenthood, introduction-at-construction}.
--
-- a Module-of-functions RECEIVES capabilities per-call via introduction-per-call;
-- references dissolve on return; between calls M has no authority.
--
-- operational test:
--   "outside any invocation of M, does M still hold a capability reference
--    to anything that exercises effects?"
--      yes → Service   (authority held persistently)
--      no  → function / Module-of-functions (authority transient per-call)
--
-- the three sources of persistent authority-holding map to Miller §9.2.5:
--   parenthood          — M created the thing and owns its lifetime
--   initial conditions  — M captured an ambient / global at module-load
--   introduction(ctor)  — M received the reference during Layer.scoped build
--                         and retained it in closure
--
-- introduction-per-call (arguments passed to a method that end on call-return)
-- is NOT persistent authority-holding — it is transient capability-passing.

fix := make-grant-explicit ∨ reduce(Needs(x)) ∨ attenuate(Pub(x))

  detail :: /skills lawful-systems-engineering
</service>

<module>
-- Reynolds 1983, "Types, Abstraction and Parametric Polymorphism"
-- MacQueen ML modules
--
-- a Reynolds unit: structure + signature. a named cohesive concept with a
-- typed public interface, hiding its representation.
--
-- Module ⇔ a file hosting a coherent named concept with a public surface.
-- NOT every file is a Module. a utility grab-bag without a cohesive named
-- concept does not qualify as a Module.
--
-- a Module hosts ONE or MORE of:
--   - types and functions (library / algebra / DSL)
--   - a Service            — authority-bearing tenant; see <service>
--   - a Datum              — non-authority-bearing tenant; see <datum>
--   - Layer exports        — constructors for its Service or Datum; see <layer>
--
-- hierarchy:
--   Module                 — the house (Reynolds)
--     ⊇ Service            — authority-bearing tenant (Miller)
--     ⊇ Datum              — non-authority-bearing tenant
--
-- every Service lives in a Module. every Datum lives in a Module.
-- not every Module hosts a Service or Datum; some are pure libraries.
</module>

<datum>
-- a Reynolds-Module whose Tag holds a branded primitive or pure value —
-- no methods exercising effects, no authority held, no capability exercised
-- by virtue of existence.
--
-- authority test (from <service>):
--   "outside any invocation, does M hold a capability reference?"
--     Datum answers NO — the value is inert data.
--   "called with zero arguments / used without context, can M cause effects?"
--     Datum answers NO — yielding the Tag reads a value; nothing is caused.
--
-- purpose: route configuration, identity, or branded primitives through
-- Effect's R-channel so downstream Services can type-safely depend on them
-- without wiring them through explicit function arguments at every call site.
--
-- constructor: a Constructive Layer (see <layer>).
-- Datum ≠ Service. a Datum fails the authority-holding test in <service>.
-- Datum ⊂ Module. a Datum lives in its own file like any named concept.
--
-- a Datum is not a Module-of-functions — it is a named value delivered
-- through the R-channel, not a library of transformations.
</datum>

<layer>
-- Moggi 1991, "Notions of Computation and Monads" | Effect R-channel
--
-- Layer ⇔ a CONSTRUCTOR for a Service OR a Datum.
-- populates Effect's R-channel with a value addressable via a Tag.
-- the keyword is CONSTRUCTOR.
--
-- Layer::Role ∈ {
--   Constructive
--     standalone constructor. produces a new Service or Datum from the base R.
--     a Constructive Layer for a Service is the canonical "service constructor".
--     a Constructive Layer for a Datum delivers a branded primitive.
--
--   Transformative
--     dependent constructor. endomorphic form Layer<S, E, S>.
--     wraps / attenuates an existing Service into a refined Service.
--     STILL a constructor of a Service — just dependent on another constructor.
--     caretaker and membrane forms per <service> layer-taxonomy.
-- }
--
-- every Layer is a constructor. existence of a Layer does NOT imply existence
-- of a Service — a Constructive Layer may produce a Datum instead.
-- endomorphic Layers always produce Services.
--
-- Tag = the capability witness.
-- possession of a Tag confers the right to yield its value from R.
-- what the Tag delivers:
--   Service interface  (Miller-unit; see <service>)
--   Datum value        (branded primitive or config; see <datum>)
</layer>

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

  detail :: /skills platform-abstraction
</layer-memoization>

<module-conventions>
-- file layout
internal/module.ts                      -- impl, private ctors, mutable internals; no public exports
Module.ts                               -- tag + public api + layer type; imports internal + follows JSDOC conventions (must grep for JSDOC conventions within directory)
bun/Module.ts | browser/Module.ts       -- platform specific layer exports

-- tag
class s extends context.tag("s")<s, { … }>() {}
s ∈ r until layer.provide → r = never

  detail :: /skills ai-context-writer
</module-conventions>

<epistemology>
-- truth precedence (descending authority)
doctrine        -- architecture docs, agents, ai-context, formal notes, specs
contract        -- exports, types, canonical tests
examples
implementation  -- evidence, not doctrine
comments
prior knowledge -- weakest; never project onto local dependency

-- code is a witness, not the truth
-- classify before editing:
lawful-witness    :: directly realizes intended algebra
partial-witness   :: some semantics formal, some informal
residue           :: reflects older ontology still present
counterexample    :: violates, collapses, or obscures intended semantics
missing-witness   :: semantics required but not yet represented

-- skepticism rules
¬assume(hostalg(l) = use(s, l))         -- local usage ≠ full host algebra
¬infer(libsemantics, oneusagesite)       -- one site is not a sample
¬normalize(doctrine, implementation)    -- never bend doctrine to match accident
¬justify(surface, ∃surface)             -- existence is not justification
¬claim(hostsemantics) until recovered(hostalg(l))

-- admissibility law
architecturalclaim(p) admissible ⇒ evidence(p) ≥ requiredevidence(p)
requiredevidence(p)   = doctrine ∨ publiccontract ∨ canonicaltests

-- humility rule
assumptions :: weak evidence
proofs       :: strong evidence
analogy      :: not evidence

  detail :: /skills lawful-systems-engineering
</epistemology>

<abstraction-discipline>
-- unclear surface → escalate, do not speculate in detail
unclear(s) → escalate(abstraction(s)) → recover(algebra(s)) → descend(concrete(s))

-- direction of thought
abstract → concrete        -- always
¬concrete → abstract       -- never work bottom-up from confusing impl

-- levels
l₀  implementation  -- evidence only; may be partial, residue, or counterexample
l₁  algebra         -- carriers, constructors, combinators, laws
l₂  ontology        -- what exists, what has authority, what the boundaries are
l₃  doctrine        -- intended semantics, architecture intent, formal notes

-- when stuck, the move is always:
stuck(l₀) → recover(l₁)
stuck(l₁) → recover(l₂)
stuck(l₂) → recover(l₃)

-- host algebra recovery (before claiming how a dependency works)
carrier(l)      :: principal value carriers
constructors(l) :: how valid values are introduced
destructors(l)  :: how values are observed, consumed, discharged
combinators(l)  :: lawful composition operators
life(l)         :: lifetime / resource semantics
fail(l)         :: failure / initial / readiness semantics

use(s, l) ⊆ hostalg(l)            -- is local usage lawful?
use(s, l) ⊊ hostalg(l)            -- suspect host algebra under-realization
¬recovered(hostalg(l)) ⇒ ¬claim(libsemantics)

-- reading order for any central dependency

1. public docs / readme / ai-context
2. public exports / types
3. canonical tests
4. examples
5. internals  ← only if 1-4 insufficient
¬invert(this order)

  detail :: /skills lawful-systems-engineering
</abstraction-discipline>

<exploration>
-- host algebra under-realization is the default assumption, not the exception
-- use(s, l) ⊊ hostalg(l)  until proven otherwise
-- local code is evidence of one path through the algebra, not the full algebra

-- exploration-first: before editing, before proposing, before claiming
¬recovered(hostalg(l)) ⇒ ¬claim(l) ∧ ¬design(l) ∧ ¬refactor(l)

-- two learning modes (run both before synthesizing)

crawl_learning :: follow the document graph
  read    readme → ai-context → .context/ → architecture docs
  follow  every referenced file, module, or doc they mention
  extract stated intent, algebra, guarantees, boundaries
  stop    at implementation; doctrine first

tool_learning :: recover the full public algebra via tools
  /modules              → enumerate packages with aireadme first-paragraphs + read-more pointers
  /module-search        → filter modules by pattern
  grep .context/        → find local doctrine, patterns, plans
  read public exports   → types, constructors, combinators
  read canonical tests  → behavioral specification
  stop    at internals unless 1-4 are insufficient

-- synthesis protocol
suggest(findings) → await(confirmation) → fold_in(confirmed)
¬fold_in(unconfirmed)
¬assume(confirmed, absence-of-objection)

-- what to look for
under-realization  :: local code rebuilds what hostalg(l) already provides
bypass             :: local code routes around a stronger primitive
distortion         :: local wrapper teaches a weaker model than hostalg(l)
gap                :: semantics clearly needed, no witness in hostalg(l)

-- the question that drives exploration
"what does the full public algebra of l make possible
 that use(s, l) does not currently exploit?"

  detail :: /skills codebase-explorer, /skills parallel-explore
</exploration>

<surface-economy>
-- a surface is justified only if:
necessary(n)           ∨  -- ¬∃ existing composition realizing same guarantees
guaranteeimproving(n)  ∨  -- γ(n) ⊋ γ(c_old)
boundaryexposing(n)       -- canonical boundary; removes non-local proof burden

-- dominance test
γ(c)  :: guarantees of surface c
σ(c)  :: moving-part / indirection / learning cost of c

c₁ ⪰ c₂  iff  γ(c₁) ⊇ γ(c₂) ∧ σ(c₁) ≤ σ(c₂)
c₁ ≻ c₂  iff  c₁ ⪰ c₂ ∧ (γ(c₁) ⊋ γ(c₂) ∨ σ(c₁) < σ(c₂))
c_existing ≻ n  ⇒  inadmissible(n)

-- constructor authority
ctor(x)  :: authority over existence of x
         -- decides: capabilities, acquisition, ownership, timing, sharing, finalization
time(x)  :: lazy | eager | scoped | memoized | demand-driven

-- constructor admissibility
altctor admissible iff:
  semanticallyinert(altctor)       -- pure, non-acquiring, non-subscribing,
                                   -- non-scheduling, non-owning teardown
  ∨ γ(altctor) ⊋ γ(ctor)
  ∨ canonicalboundary(altctor)

internalonly(altctor)             ⇏  admissible(altctor)
rewrappedbystrongerouter(altctor) ⇏  admissible(altctor)

-- fusion rule
c_strong = wrap(c_weak) ∧ γ(c_weak) ⊂ γ(c_strong)
⇒ invalidbydefault(c_weak)
⇒ fuse(c_strong, c_weak)

-- producer-first principle
settle(producer truth) before adapt(consumers)
truth order: boundary → emitted semantics → construction → consumers

-- smell taxonomy
host-algebra-under-realization  :: use(s,l) ⊊ hostalg(l); rebuilding what l provides
distorted-teaching-surface      :: local wrapper teaches weaker model than l
repair-requiring-intermediate   :: c_weak wrapped by c_strong; fuse it
residual-dual-ontology          :: old + new surface coexist; teaching conflict
smuggled-semantics              :: guarantee present in behavior, absent in type
ambient-authority               :: needs(x) ⊄ closure(grants(x))

  detail :: /skills lawful-systems-engineering, /skills semantic-hard-cut-refactor
</surface-economy>

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
gates(typecheck, test) := delegate(agent) ∧ ¬run-directly(orchestrator)
significant(changes)   := |files| > 1 ∨ architectural(impact)
</gates>

<commands>
/modules         → list(aireadme-first-paragraphs, read-more-pointers)
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
conditionals        → match.typetags(adt) ∨ $match
domain-types        := schema.taggedstruct
imports             := ∀ x → import * as x from "effect/x"
{date.now, random}  → {clock, random}

  detail :: /skills domain-modeling
</style>

<effect-patterns>
effect.gen          over  effect.flatmap chains
pipe(a, f, g)       over  g(f(a))
schema.taggedstruct over  plain interfaces
layer.provide       over  manual dependency passing
catchtag            over  catchall with conditionals
data.taggederror    over  new error()
array.filtermap     over  .filter().map()
array.partitionmap  over  separate filter passes
hashmap             over  plain object when key is structural
data.struct         over  manual [equal.symbol] / [hash.symbol] impl

as any              →  schema.decode ∨ type guard
promise             →  effect.trypromise
try/catch           →  effect.try ∨ effect.catchtag
null/undefined      →  option<a>
throw               →  effect.fail(taggederror)
=== on objects      →  equal.equals
plain obj as key    →  data.struct + hashmap

  detail :: /skills error-handling, /skills pattern-matching
</effect-patterns>

<ui>
¬borders → lightness-variation
depth := f(background-color)
elevation := δlightness ∧ ¬stroke
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

<performance-primer>
hot-site-shape-stability :: monomorphic ≻ polymorphic ≻ megamorphic ≻ generic
megamorphic-ic :: pollutes shared cache → cross-site degradation, not local

shape (hidden class):
  fields    :: declared in body, fixed init order
  ctors     :: same property assignments at every site (factory monomorphism)
  ¬post-hoc :: no field added to hot-path object after construction
  ¬reorder  :: existing field order is load-bearing; reordering invalidates jit stubs
  methods   :: prototype-bound, ¬per-instance closure assignment
  ¬delete   :: dictionary-mode demotion, permanent

dispatch:
  prototype-method   :: monomorphic per class
  delegator-method   :: only wins when v8 inlines it; tier-dependent
  own-property-fn    :: shape-stable iff factory pattern is consistent
  variant-classes    :: helps only if baseline factory is not consistent

predicates:
  === undefined         :: tagged-value test, single instruction
  sentinel.length !== 0 :: heap deref + slot load, more work
  --

  branch-on-value :: input-distribution shifts → cpu mispredict
  swap-fn-at-ctor :: prefer over hot-path branch when target is stable per-instance

retention (memory ≠ speed):
  closure :: retains enclosing lexical scope (heavy locals → leak)
  bind    :: retains only `this`              (long-lived refs prefer)
  pool    :: wins iff alloc was binding cost ∧ access pattern preserves
          :: forbids closure→property conversion at hot site
  scratch :: re-entrant recursion → single buffer corrupts; verify call graph

fusion (reactive containers):
  atom.map(f) ∘ atom.map(g) ≡ atom.map(f ∘ g)   -- prefer fused; fewer nodes/subscriptions
  free combinators from named structure (functor/monad/etc.) :: see <algebra>

discipline:
  bench-before-claim :: theory ≠ measured win
  baseline-may-be-optimal :: refactor may pessimize already-monomorphic site
  warmup-tier :: sparkplug ¬inline; maglev/turbofan inline
              :: bench warmup must reach optimizing tier or measurements lie

  detail :: /skills js-engine-performance, /skills bun-benchmarking
</performance-primer>

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
