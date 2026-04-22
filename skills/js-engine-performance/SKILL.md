---
name: js-engine-performance
description: Shape stability, inline cache theory, dispatch cost, memory retention, and JIT tiering for V8 and JSC. Use when profiling hot paths, reviewing performance-sensitive code, benchmarking, or evaluating whether a refactor will improve or regress runtime behavior in V8 or Bun/JSC contexts.
---

# JS Engine Performance

## Purpose

Use this skill when writing, reviewing, or profiling performance-sensitive code that runs on V8 (Node.js, Chrome) or JSC (Bun, WebKit). It covers the causal chain from source-level patterns to IC state, hidden class transitions, JIT tier behavior, and memory retention. Claims are cited to primary engine-team sources or marked as experimental where no primary source exists.

---

## Inline Caches (ICs)

An inline cache is a per-call-site data structure that caches the result of a property lookup or dispatch based on the receiver's hidden class (shape). The engine patches the call site with a fast path for the observed shape. On the next call, if the shape matches, the fast path executes without rediscovering the property offset.

### IC States

```text
monomorphic   — 1 shape seen; fast constant-time lookup
polymorphic   — 2–N shapes seen (N ≤ ~4 for property loads); linear scan of cached entries
megamorphic   — N shapes exceeded; probes a global hash table
generic       — IC disabled; no caching
```

The ≤4 threshold for property load ICs is sourced from V8 specifically and was reported in 2015 (Vyacheslav Egorov, mrale.ph/blog/2015/01/11/whats-up-with-monomorphism). V8 may have tuned this value since. JSC uses a similar polymorphic IC model (webkit.org/blog/10308/speculation-in-javascriptcore) but does not publish the same threshold. Treat 4 as a well-sourced approximation for V8 property loads, not a guaranteed constant.

### The Megamorphic Cliff

Megamorphic ICs do not degrade gradually. When the IC state transitions from polymorphic to megamorphic, the engine stops storing entries locally at the call site and routes lookups through a global hash table (mrale.ph/2015). This creates two problems:

1. The call site itself becomes slow.
2. Unrelated monomorphic or polymorphic call sites that happen to share the same global IC hash table may be evicted, making them slower even if their own shape discipline is perfect.

Cross-site contamination is the most counterintuitive consequence: a single megamorphic site can make nearby sites regress. When profiling, look for megamorphic sites not just at the bottleneck but nearby it.

### IC Invalidation

Prototype mutations invalidate ICs globally. V8 uses a ValidityCell per prototype; mutation stamps the cell, and any IC that depended on that prototype chain is marked for deoptimization (mathiasbynens.be/notes/prototypes). A single `Object.prototype.foo = ...` in library code can trigger a broad deoptimization wave.

---

## Hidden Classes and Shape Stability

V8 uses HiddenClasses; JSC uses Structures. Both terms refer to the same concept: a per-object descriptor recording property names, offsets, and types. The term "shape" is used below as the engine-neutral name.

### Transition Trees

Every time a new property is added to an object, V8 creates a new HiddenClass and links it to the previous one via a transition edge (v8.dev/blog/fast-properties, Meurer/Bruni 2017). The transition is cached: if two construction paths add the same properties in the same order, they converge on the same final HiddenClass.

```text
{}
 └─ .x   → Shape_x
             └─ .y  → Shape_xy   ← both paths land here if add order is consistent
{}
 └─ .y   → Shape_y
             └─ .x  → Shape_yx   ← different final shape; same property names, different order
```

### Factory Monomorphism

All instances of a factory share one final hidden class if and only if every construction path assigns properties in the same order. This is the key correctness condition for IC monomorphism (mathiasbynens.be/notes/shapes-ics).

```ts
declare const AtomProto: object

// Consistent add order — all instances share one final shape
function makeAtom(read: () => number, write: (v: number) => void) {
  const self = Object.create(AtomProto)
  self.read = read   // always first
  self.write = write // always second
  return self
}
```

```ts
// Inconsistent add order — transition tree forks; IC at call sites sees two shapes
function makeAtomBad(read: () => number, write?: (v: number) => void) {
  const self = Object.create(AtomProto)
  self.read = read
  if (write) self.write = write // conditional: shape forks here
  return self
}
```

Class field declarations solve this mechanically. ES class instantiation initializes fields in declaration order, producing a single shared shape for all instances of that class. The requirement for uniform initial value types still applies: initializing a numeric field with `undefined` then later assigning an integer can cause shape deprecation (v8.dev/blog/react-cliff).

```ts
class Atom {
  // Field order is the shape order; consistent across all instances
  read: () => number
  write: (v: number) => void

  constructor(read: () => number, write: (v: number) => void) {
    this.read = read
    this.write = write
  }
}
```

For numeric fields, initialize with a same-type sentinel (`0`, `Number.NaN`), not with `undefined`:

```ts
// Prefer: stable SMI representation from the start
class Counter { value = 0 }

// Avoid: undefined → integer transition may cause shape deprecation
class CounterBad { value = undefined as unknown as number }
```

### `delete` and Dictionary Mode

`delete obj.field` permanently demotes the object to dictionary (slow-properties) mode in V8 (v8.dev/blog/fast-properties). Dictionary properties are hash-table-backed; ICs do not work on them. V8 does not promote objects back to fast mode automatically.

```ts
// Permanently breaks IC at every site that reads obj.x
delete obj.x
```

Never use `delete` on objects in hot paths. Use `undefined` assignment or optional chaining instead, and accept the `undefined` check at read sites.

---

## Dispatch

### Prototype Methods

A prototype method is monomorphic per class: all instances share the same prototype, and the IC at a call site sees one shape → one prototype → one method target (mathiasbynens.be/notes/prototypes). This is the cheapest dispatch model. The shape must be stable for the IC to stay monomorphic — if instances of the same class have different shapes (e.g., because property add order varies), the method lookup IC degrades even though the method lives on the prototype.

### Own-Property Functions (Per-Instance Closures)

Assigning a closure to an own property gives each instance a different function value at the same property offset. The property load IC may remain monomorphic (same shape, same slot) but the call IC at `obj.method()` sees many distinct function targets and degrades to megamorphic (mrale.ph/2015). Even if the property load is monomorphic, the call dispatch is megamorphic.

```ts
// Property load: monomorphic (all instances have same shape)
// Call dispatch: megamorphic (each closure is a distinct function object)
function makeHandler(state: State) {
  return {
    handle: (event: Event) => process(state, event) // new closure per instance
  }
}
```

```ts
// Property load: monomorphic
// Call dispatch: monomorphic (all instances share the same prototype.handle)
class Handler {
  constructor(private state: State) {}
  handle(event: Event) { process(this.state, event) }
}
```

The prototype method is strictly cheaper at the call site when the class is used uniformly.

### Delegator Methods and Inlining

A delegator pattern wraps a method call to add pre/post logic or routing:

```ts
class DelegatingAtom {
  inner: Atom
  read() { return this.inner.read() }  // delegator
}
```

The delegator's call to `this.inner.read()` is a separate call site. Whether the engine inlines the inner call depends on the JIT tier. In V8:

- Sparkplug (non-optimizing) does not inline (v8.dev/blog/sparkplug).
- Maglev and TurboFan use IC feedback and may inline.

The delegator pattern only eliminates call overhead if the optimizing tier inlines it. At Sparkplug/Ignition tier — which is where code runs before it is hot enough to tier up — the delegator pays double dispatch. If the delegator is the bottleneck, measure at steady-state (post-tier-up), not cold.

### Variant Classes

Creating a variant class (subclass or structurally different class) for a hot dispatch site only helps if the baseline factory is inconsistent. If instances already share a stable shape (the factory is already monomorphic), introducing a variant class makes the call site polymorphic. A call site that previously saw one shape now sees two.

```text
Baseline: all instances → Shape_A → IC: monomorphic
After introducing VariantClass: instances → Shape_A | Shape_B → IC: polymorphic

Result: regression, not improvement.
```

The correct question before introducing a variant is: does the existing factory produce a single stable shape? If yes, the variant class will pessimize. If no (the factory already produces multiple shapes), a variant class that makes the polymorphism explicit can help the IC see a smaller, stable set.

---

## Cost Asymmetries

### `=== undefined` vs Property Access

`x === undefined` is a cheap tagged-pointer equality test. V8 represents `undefined` as a specific singleton; the comparison requires no heap dereference and no slot load (v8.dev/blog/pointer-compression). "Single instruction" is a JIT-tier-dependent claim and was not confirmed by a primary source; "no heap dereference required" is confirmed structurally.

`x.length !== 0` requires: load pointer to the JSObject, load the property at its offset, then compare (v8.dev/blog/fast-properties). For a hot TurboFan-optimized loop, the access can be hoisted and absorbed. For Sparkplug/Ignition tiers, it is meaningfully more work. Structurally, the `=== undefined` test is cheaper; the magnitude narrows in the optimizing tier.

Prefer `=== undefined` membership tests over always-defined empty-sentinel collections for short-lived existence checks (experimental observation; see effect-atom Apr-2026 perf experiment).

### Closure Capture in Loops

Closure variables live in a Context object; access is one indirection through the context pointer (mrale.ph/blog/2012/09/23/grokking-v8-closures-for-fun, Egorov 2012). In modern TurboFan, escape analysis may eliminate the context allocation and treat captured variables as SSA values directly. In Sparkplug/Ignition, the indirection is real. For hot inner loops, closures over frequently-accessed variables are not a significant concern in the optimizing tier.

### Bind vs Closure

TurboFan (V8 v6.4+, ~2018) inlines all monomorphic calls to `Function.prototype.bind` (v8.dev/blog/v8-release-64). The qualifier "monomorphic" is load-bearing: a call site that always binds the same callback+this pair is inlined; a polymorphic bind call site is not covered. For hot paths with a stable (monomorphic) call pattern, bound functions in TurboFan are equivalent to closures from a dispatch-cost standpoint.

Whether closure or bind is faster for hot paths in general is context-dependent; no engine team primary source makes a general comparative claim. Do not encode a rule here (validated as folklore — claim #15 in the validation doc).

The memory distinction is real and matters separately (see Retention section).

---

## Retention

### Closure Retention

A closure retains its entire enclosing lexical scope via a JSLexicalScope (Context) object (bun.com/blog/debugging-memory-leaks, Bun team 2024; mrale.ph/blog/2012/09/23, Egorov 2012). All variables in the enclosing scope are retained, including those the closure never reads. In async contexts, nested callbacks can form a chain of retained scopes.

The Bun memory-leaks article demonstrates this with an AbortSignal example: `() => controller.abort()` retains the entire enclosing `init` scope, which may include request bodies, response objects, and other large structures. The mechanism is confirmed. The specific "1 GB savings" figure attributed to a social-media post was unverifiable; treat the magnitude as anecdotal.

Modern V8 escape analysis can elide context allocation when captured variables do not escape. For deeply nested or async callbacks (where escape analysis does not apply), the retention chain is real and observable.

### Bind Retention

`fn.bind(thisArg)` retains only `thisArg`, not the surrounding lexical scope (bun.com/blog/debugging-memory-leaks). The bound function holds a direct reference to `thisArg` and the target function; it does not create a JSLexicalScope.

```ts
// Retains entire enclosing scope (all locals, including large objects)
const unsubscribe = () => emitter.off("change", handler)

// Retains only `emitter` — no outer scope retained
const unsubscribe = emitter.off.bind(emitter, "change", handler)
```

### Rule for Long-Lived References

For references stored in registries, listener maps, weak maps, or finalizer queues — where the function will survive across GC cycles — prefer bind over closure when the required capabilities fit the bind signature. The win is avoiding JSLexicalScope retention of variables not needed by the long-lived reference (bun.com/blog/debugging-memory-leaks).

For hot transient invocations (called frequently, short-lived), the choice between closure and bind is a dispatch-tier question (see Bind vs Closure above), not a memory question.

---

## Object Pooling

### When Pooling Wins

Pooling reduces allocation pressure when:

1. The object is large enough that allocation is non-trivial.
2. GC pressure is the measured bottleneck — specifically, objects surviving to the old generation.
3. The access pattern ensures the pooled object is not aliased at re-use time.
4. Re-initialization cost is lower than allocation cost.

V8's generational GC (Scavenger for nursery, Major GC for old generation) makes short-lived objects nearly free: "we only pay a cost proportional to the number of surviving objects, not the number of allocations" (v8.dev/blog/trash-talk, V8 GC team 2019). Pooling short-lived objects that die in the nursery is an anti-optimization: it fights the generational GC's native advantage.

### When Pooling Loses

Pooling forces a change in how state is managed: instead of capturing state in a closure (one allocation, zero property accesses for captured vars), you read it from properties on the pooled object (property load per access). For hot call sites where the closure is currently monomorphic, this conversion may pessimize.

Re-entrancy bugs are a correctness risk: if the same pooled buffer is returned to the pool while still in use by a caller, aliasing occurs. The GC eliminates this risk by construction; pooling does not.

```text
Pooling evaluation checklist:
  - Is GC pressure the confirmed bottleneck (measured, not assumed)?
  - Do pooled objects survive nursery GC (i.e., go old-gen)?
  - Does the pooled object's access pattern remain shape-stable?
  - Is re-entrancy impossible given the call graph?
  - Is the initialization cost actually lower than allocation?

If any answer is no: do not pool.
```

---

## JIT Tiering (V8 and Bun/JSC)

### V8 Tier Stack

```text
Ignition (interpreter)
  → Sparkplug (non-optimizing baseline JIT; ~2021)
  → Maglev (mid-tier optimizing JIT; ~2023)
  → TurboFan (full optimizing JIT)
```

Sparkplug is explicitly non-optimizing (v8.dev/blog/sparkplug): "Basically just builtin calls and control flow." Inlining does not occur in Sparkplug. Maglev uses IC feedback and generates specialized SSA-style IR (v8.dev/blog/maglev). TurboFan performs full inlining, loop optimization, and escape analysis. Inlining begins no earlier than Maglev.

### JSC Tier Stack

```text
LLInt (interpreter)
  → Baseline JIT (non-optimizing)
  → DFG (Data Flow Graph; mid-tier; inlines based on profiling)
  → FTL (Fourth-Tier LLVM / B3; full optimization; polyvariant devirtualization)
```

DFG inlining enables FTL to perform polyvariant devirtualization: inlining a polymorphic call site into per-variant branches, then optimizing each branch independently (webkit.org/blog/3362/introducing-the-webkit-ftl-jit, Pizlo 2014).

### Bench Warmup Requirement

Benchmark measurements taken before code has reached the optimizing tier measure interpreter + baseline JIT overhead, not steady-state hot-path cost. This is a common validity failure.

For V8: a function must be called enough times for Maglev or TurboFan to profile and compile it. For JSC/Bun: a function must be called enough times for DFG or FTL to compile it. Typical thresholds are O(hundreds) to O(thousands) of calls, depending on function size and engine configuration.

Before treating a benchmark result as meaningful:
1. Confirm the hot function has been compiled by the optimizing tier (use `--trace-opt` for V8 or Bun's profiling tools).
2. Include a warmup phase with enough iterations to reach steady-state.
3. See `/skills bun-benchmarking` for measurement methodology.

---

## Anti-Pattern Catalog

### Adding a Field to a Hot-Path Object After Construction

```ts
// ❌ Adds a new property outside the constructor; creates a new hidden class transition
//    at every site that later reads this object; may fork the transition tree
function augmentAtom(atom: Atom, debugLabel: string) {
  (atom as any).debugLabel = debugLabel
  return atom
}

// ✅ Declare in the class body or factory; consistent add order at construction time
class Atom {
  debugLabel: string | undefined = undefined
  // ...
}
```

### Inserting a Branch in a Hot Accessor for a "Fast Path"

```ts
// ❌ The branch check is now on every call; the "fast path" may be slower than
//    the original code if the engine had already inlined/optimized the original form
read() {
  if (this._cachedValue !== UNSET) return this._cachedValue  // branch on every read
  return this._compute()
}

// ✅ Benchmark first. If the original form is already in TurboFan, the branch
//    may add IC complexity without helping. Memoization belongs at the
//    construction site if the value is truly stable.
```

### Replacing Closure Access with Property Access on a Pooled Object

```ts
// ❌ Converting closure-captured state to properties forces property loads at
//    every access site; destroys existing IC monomorphism if access patterns change
class PooledAtom {
  state!: State  // previously a closure-captured local
  read() { return this.state.value }  // now a property load chain
}

// ✅ Measure GC pressure first; pool only when objects survive to old generation
//    and the access-pattern shape is stable
```

### Variant Classes for an Already-Monomorphic Factory

```ts
// ❌ If the base factory is already shape-monomorphic, adding a variant class
//    makes every call site that accepts both types polymorphic
class ReadonlyAtom extends Atom { /* ... */ }

// Now: call sites receiving Atom | ReadonlyAtom see two shapes → IC degrades

// ✅ Use a single class with a runtime flag, or a wrapper that presents the
//    same shape (delegation with the same outer class)
```

### Sentinel Arrays vs `=== undefined` for Short-Lived Membership

```ts
// ❌ Allocates an array; read requires: pointer load + length check or index load + compare
//    Always initializes to non-undefined, preventing the cheaper existence check
const listeners: Listener[] = []
if (listeners.length > 0) { /* ... */ }

// ✅ undefined-check is a tagged-pointer equality with no heap dereference;
//    for sparse, short-lived membership tracking the undefined sentinel is cheaper
let listeners: Listener[] | undefined
if (listeners !== undefined) { /* ... */ }
```

---

## Decision Rules

### When Not to Refactor

The baseline may already be optimal. If the factory is already monomorphic (one stable shape), call sites are already in the best possible IC state for that factory. Refactoring to "improve shape stability" for an already-stable factory adds code complexity with no IC benefit.

Refactors that change property add order, introduce new property names, or change the class hierarchy make call-site IC state worse during the transition and may not recover to the previous level if the new pattern is less consistent.

### Bench-Before-Claim

Performance intuition is not performance evidence. Required steps before claiming a pattern is faster:

1. Measure the actual bottleneck (profiler, not guessing).
2. Confirm the code under question has reached the optimizing tier during the benchmark.
3. Run enough iterations for GC noise to average out (see bun.com/docs/project/benchmarking for `Bun.gc(true)` + `heapStats()` patterns).
4. For sub-µs scenarios: machine quiescing is required; GC noise and OS scheduler jitter dominate at that scale. No primary source gives a universal µs threshold; treat sub-µs measurements without quiescing as noise-dominated (experimental observation; validated against bun.com/docs/project/benchmarking).

### The Baseline May Already Be V8-Optimal

TurboFan can inline monomorphic call sites, eliminate context objects via escape analysis, and hoist invariant loads. Code that looks expensive at the source level may compile to identical machine code as a "hand-optimized" variant. A refactor that moves semantics from closures to properties, or from prototype methods to own-property functions, may produce machine code that is equivalent or worse.

The correct approach: profile under the optimizing tier, identify the actual bottleneck, and measure the proposed change against the baseline at steady-state.

---

## Cross-References

- `/skills bun-benchmarking` — measurement methodology: `Bun.nanoseconds()`, `Bun.gc(true)`, `heapStats()`, mitata, warmup discipline, GC noise.
- `CLAUDE.md <performance-primer>` — the always-loaded summary of shape stability and IC rules for inline reference during code review.

---

## Sources

| Source | What it covers |
|--------|---------------|
| mathiasbynens.be/notes/shapes-ics | Shapes, transition trees, IC monomorphism; canonical reference |
| mathiasbynens.be/notes/prototypes | Prototype chains, ValidityCell, IC invalidation on prototype mutation |
| v8.dev/blog/fast-properties | HiddenClass, transition trees, delete → dictionary mode, fast vs slow properties |
| v8.dev/blog/react-cliff | Shape deprecation, field representation changes, numeric field initialization |
| v8.dev/blog/sparkplug | Sparkplug non-optimizing tier; no inlining |
| v8.dev/blog/maglev | Maglev mid-tier; IC feedback; SSA specialization |
| v8.dev/blog/v8-release-64 | TurboFan inlines monomorphic bind (V8 v6.4) |
| v8.dev/blog/trash-talk | V8 generational GC; short-lived object cheapness; pooling tradeoffs |
| v8.dev/blog/pointer-compression | SMI/tagged-value representation |
| mrale.ph/blog/2015/01/11 | IC states, ≤4 threshold for property loads, megamorphic global hash table, cross-site contamination |
| mrale.ph/blog/2012/09/23 | Context objects, closure capture mechanics, retention chains |
| bun.com/blog/debugging-memory-leaks | JSLexicalScope retention, bind vs closure memory, AbortSignal example |
| bun.com/docs/project/benchmarking | Bun.nanoseconds, Bun.gc, heapStats, bench tooling |
| webkit.org/blog/3362 | JSC FTL tier, DFG inlining, polyvariant devirtualization |
| webkit.org/blog/10308 | JSC IC polymorphism, speculation, tier thresholds |
