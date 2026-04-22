---
name: bun-benchmarking
description: Rigorous microbenchmarking on Bun. Use when measuring performance-critical code, comparing two implementations, or validating that a refactor wins or does not regress. Covers harness primitives, statistical validity, GC isolation, JIT warmup, and the comparison decision rule.
---

# Bun Benchmarking

## Purpose

Use this skill when you need a defensible answer to: "is implementation A faster than B?"

Defensible means: measured with ns-resolution timing, GC-isolated between runs,
JIT-warmed before measurement, reported with mean ± stddev, and compared via Welch's
t-test at p < 0.05.

Without all of these, a perf claim is folklore.

Use cases:
- Measuring a hot-path change before committing it
- Comparing two implementations of the same function
- Validating that a refactor improves (or at minimum does not regress) performance
- Building the evidentiary record for a performance claim

The reference implementation for this skill is `bench/` in the effect-atom repo.
All patterns below are drawn from `bench/harness.ts`, `bench/compare.ts`, and
`bench/scenarios/10-reactive-fibonacci.ts`.

---

## Harness Primitives

### `Bun.nanoseconds()`

Monotonic ns-resolution timer. Returns ns since process start.
([bun.com/docs/project/benchmarking](https://bun.com/docs/project/benchmarking))

```typescript
const t0 = Bun.nanoseconds()
doWork()
const elapsed = Bun.nanoseconds() - t0  // nanoseconds, not milliseconds
```

Practical resolution is OS-limited: ~40-50 ns jitter on macOS, lower on Linux.
"Nanosecond unit" is not the same as "nanosecond precision" — do not rely on
sub-40ns measurements being meaningful on macOS without quiescence.

❌ `Date.now()` — millisecond resolution, useless for sub-ms work  
❌ `performance.now()` — lower resolution and higher overhead than `Bun.nanoseconds()`  
✅ `Bun.nanoseconds()` for all benchmark timing

### `Bun.gc(true)` and `Bun.gc(false)`

([bun.com/docs/project/benchmarking](https://bun.com/docs/project/benchmarking))

- `Bun.gc(true)` — synchronous; blocks until GC completes
- `Bun.gc(false)` — async hint; GC runs at some future point

Use `Bun.gc(true)` before every timed run to flush pressure from the previous run.
Follow with a short sleep to let async finalizers settle:

```typescript
Bun.gc(true)
await new Promise<void>((r) => setTimeout(r, 5))
```

Without this, objects from run N may be collected during run N+1, injecting GC
pauses into the measured time and inflating variance unpredictably.

### `heapStats()` from `bun:jsc`

([bun.com/docs/project/benchmarking](https://bun.com/docs/project/benchmarking))

Returns detailed heap metrics: heap size, capacity, object counts, and a
breakdown of object types currently in the JS heap.

```typescript
import { heapStats } from "bun:jsc"

const before = heapStats()
doWork()
const after = heapStats()

const heapDelta = after.heapSize - before.heapSize
const objCountDelta = after.objectCount - before.objectCount
```

`heapStats()` does not trigger GC. Call `Bun.gc(true)` first to get a
post-collection view; otherwise you are measuring heap including garbage not yet
collected.

### `MIMALLOC_SHOW_STATS=1`

Set this env var to print native heap stats on process exit. Useful for detecting
native-side allocations not visible via `heapStats()`.

```sh
MIMALLOC_SHOW_STATS=1 bun run bench/index.ts
```

### Blackhole sentinel (DCE guard)

The JIT can eliminate computations whose results are never observed. Defeat this
by storing every computed value in a module-level variable:

```typescript
let _sink: unknown

export const blackhole = (v: unknown): void => {
  _sink = v
}
```

Call `blackhole(result)` at the end of every timed iteration. Without this, the
optimizer may remove the entire body of your hot loop at DFG/FTL tier.

❌ Not blackholing: optimizer elides the work; you measure nearly zero  
✅ `blackhole(result)` after every operation under measurement

---

## Two Layers of Statistical Validity

Two distinct noise sources require two distinct mitigations. They do not
substitute for each other.

### Layer 1: Iterations per run — defeats timer noise

`Bun.nanoseconds()` jitter is ~10-100 ns. If your operation takes 50 ns,
one iteration per run gives 20-200% noise. The fix is to repeat the operation
many times inside a single timed region:

```typescript
run: (state) => {
  for (let i = 0; i < ITERS; i++) {
    blackhole(state.registry.get(state.atom))
  }
}
```

Then normalize: `nsPerOp = elapsedNs / ITERS`.

Target RSD < 5% (see below). If RSD is high, increase `ITERS`.

### Layer 2: Runs across runs — defeats environmental noise

A single run may be skewed by a background OS task, a JIT deoptimization, or a
lucky cache state. Run the timed region many times (default 30 post-warmup) and
compute statistics over the distribution.

```typescript
export const RUNS = Number(process.env["RUNS"] ?? 30)
export const WARMUP = Number(process.env["WARMUP"] ?? 5)
```

Report mean ± stddev; use p95/p99 for tail latency analysis.

**Both layers are required.** Many iterations per run without multiple runs gives
you one data point with low timer noise but no distribution. Multiple runs with
one iteration per run gives you a noisy distribution. You need both.

---

## GC Isolation Between Runs

Call `Bun.gc(true)` before every timed run — including warmup runs — then sleep
5 ms to let async finalizers settle:

```typescript
for (let i = 0; i < totalRuns; i++) {
  Bun.gc(true)
  await new Promise<void>((r) => setTimeout(r, 5))

  const beforeHeap = heapStats()
  const t0 = Bun.nanoseconds()
  opts.run(state)
  const elapsed = Bun.nanoseconds() - t0
  const afterHeap = heapStats()

  allSamples.push(elapsed)
}
```

Why the sleep: `Bun.gc(true)` is synchronous for the mark-and-sweep phase, but
some finalizers run asynchronously on a GC thread. A 5 ms pause is enough for
them to complete before the next timed region starts.

Why for warmup too: Even discarded warmup runs consume memory. Without GC before
them, warmup allocations accumulate and inflate the heap state entering the first
measured run.

---

## JIT Warmup

### JSC Tiering

Bun runs JavaScriptCore (JSC). JSC has four tiers:

1. LLInt — interpreter; first execution
2. Baseline — unoptimized JIT; after ~6 executions
3. DFG — optimizing JIT with IC feedback; after ~60 executions
4. FTL — maximum optimization; after sustained hot execution

Measurements taken before DFG is reached are measuring interpreter overhead,
not optimized code. The first few runs of a benchmark are in LLInt/Baseline.
Discard them.

See also: [webkit.org/blog/3362](https://webkit.org/blog/3362/introducing-the-webkit-ftl-jit/)
for the analogous V8 model (Sparkplug → Maglev → TurboFan): inlining begins no
earlier than Maglev/DFG, so Sparkplug-tier measurements are also pre-optimization.

### Implementation

```typescript
export const WARMUP = Number(process.env["WARMUP"] ?? 5)

const totalRuns = WARMUP + RUNS
// ...
const samples = allSamples.slice(WARMUP)  // discard first WARMUP runs
```

Default 5 warmup runs is a conservative minimum. For deep optimization paths
(e.g. FTL-tier inlining decisions), consider WARMUP=10.

❌ No warmup: measuring interpreter + baseline overhead; numbers lie  
✅ Discard first 5+ runs; measure only post-JIT-stabilized execution

---

## Statistical Comparison

### Welch's t-test

When comparing two bench runs (baseline vs candidate), use Welch's t-test
(two-sample, unequal-variance, two-tailed). This is the appropriate test when
the two samples may have different variances — which is the common case when
comparing implementations.

The test uses raw per-run sample arrays, not just the means. This is why the JSON
output stores `samples: Array<number>` (not just summary stats).

```typescript
// Two-tailed Welch t-test
function welchPValue(a: Array<number>, b: Array<number>): number {
  const meanA = a.reduce((s, v) => s + v, 0) / a.length
  const meanB = b.reduce((s, v) => s + v, 0) / b.length
  const varA = a.reduce((s, v) => s + (v - meanA) ** 2, 0) / (a.length - 1)
  const varB = b.reduce((s, v) => s + (v - meanB) ** 2, 0) / (b.length - 1)

  const se2A = varA / a.length
  const se2B = varB / b.length
  const se = Math.sqrt(se2A + se2B)
  const t = Math.abs(meanA - meanB) / se

  // Welch-Satterthwaite degrees of freedom
  const df = (se2A + se2B) ** 2 / (se2A ** 2 / (a.length - 1) + se2B ** 2 / (b.length - 1))
  return twoTailedPValue(t, df)  // via regularised incomplete beta
}
```

Full implementation in `bench/compare.ts` in the effect-atom repo.

### What to store in JSON output

Store per-run raw samples. Summary stats (mean, stddev) alone do not contain
enough information to compute t-statistics post-hoc.

```typescript
export interface BenchScenarioResult {
  name: string
  description: string
  iterationsPerRun: number
  runs: number
  samples: Array<number>  // raw ns per run, length = RUNS (post-warmup)
  stats: Stats
  heap: HeapStats
}
```

### Threshold and reporting

- p < 0.05: conventional significance threshold; document your chosen threshold
- Primary report metric: mean ± stddev per operation
- Secondary: p95, p99 for tail latency analysis

---

## RSD as Noise Indicator

RSD (Relative Standard Deviation) = stddev / mean × 100

```
RSD = (stddev / mean) × 100  [percent]
```

| RSD | Interpretation |
|-----|----------------|
| < 2% | Clean; environment is quiet |
| 2–5% | Acceptable |
| > 5% | Noise-dominated; increase `iterationsPerRun` |
| > 20% | Something is wrong: GC firing during run, machine not quiesced, scenario has external I/O |

RSD > 5% means the scenario needs more iterations per run, not more runs. Adding
runs computes a better distribution of a noisy signal; it does not reduce per-run
noise. Only increasing iterations per run amortizes timer jitter over more work.

Sub-µs scenarios are typically noisy unless the machine is quiesced. On macOS,
~40-50 ns jitter means a 100 ns operation has ~40-50% timer noise with 1
iteration per run. With 10,000 iterations per run, that same noise becomes 0.004%
of the measurement.

---

## Machine Quiescence

Quiescence matters most for sub-µs scenarios. Unquiesced machines produce
random-looking regressions and improvements that are actually noise.

Practical steps (macOS):

- Close other applications — especially browsers, Slack, music players
- Pause music playback
- Do not use the machine during a bench run
- Run the bench twice and compare; if results differ by >5%, the machine is not stable

Optional (Linux):

- Pin to a CPU core: `taskset -c 2 bun run bench`
- Disable Turbo Boost: consistent results > peak results for benchmarking
  (`echo 1 | sudo tee /sys/devices/system/cpu/intel_pstate/no_turbo`)

❌ Benchmarking while browser + Slack + music are running  
✅ Dedicated bench run with all background apps paused

---

## Scenario Design

### General rules

- Scenarios must measure real-workload-relevant operations, not synthetic microstress
- Every scenario must call `blackhole(result)` to defeat DCE
- Every scenario must validate correctness on the first run before measuring
- Use `setup()` for construction — the setup phase is not timed
- Keep mutable state inside the scenario; do not share across scenarios

### Correctness validation

Validate the scenario's output on the first run to confirm the bench is measuring
what you think it is:

```typescript
// From bench/scenarios/10-reactive-fibonacci.ts
const EXPECTED_FIB_70 = 190392490709135
let assertionDone = false

run: () => {
  for (let i = 0; i < ITERS; i++) {
    const r = Registry.make()
    const result = r.get(fib70)

    if (!assertionDone) {
      if (result !== EXPECTED_FIB_70) {
        throw new Error(`fib(70) expected ${EXPECTED_FIB_70}, got ${result}`)
      }
      assertionDone = true
    }

    blackhole(result)
  }
}
```

A scenario that produces wrong results is measuring undefined behavior. The
assertion catches regressions where the optimization breaks correctness.

### Per-run hard timeouts

Scenarios that hang (e.g. infinite loop introduced by a bug) will freeze the
entire bench run. Wrap each run in a timeout:

```typescript
async function withTimeout(p: Promise<void>, ms: number): Promise<boolean> {
  let handle: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<"timeout">((resolve) => {
    handle = setTimeout(() => resolve("timeout"), ms)
  })
  const result = await Promise.race([p.then(() => "done" as const), timeout])
  clearTimeout(handle)
  return result === "done"
}

// Default: 10 seconds per run
export const RUN_TIMEOUT_MS = Number(process.env["RUN_TIMEOUT_MS"] ?? 10_000)
```

### Heap delta per scenario

Capture heap before and after each timed run. Average the deltas across
post-warmup runs:

```typescript
const beforeHeap = heapStats()
opts.run(state)
const afterHeap = heapStats()

heapDeltas.push(afterHeap.heapSize - beforeHeap.heapSize)
objectCountDeltas.push(afterHeap.objectCount - beforeHeap.objectCount)
```

A heap delta growing across runs indicates a leak in the scenario or the code
under test. Object count delta helps distinguish retained references from
fragmentation.

---

## Comparison Decision Rule

The decision rule governs whether a candidate implementation replaces the baseline.

### Default rule (tune per project)

```
KEEP    if: ∃ scenario improved with p < 0.05 ∧ Δ ≥ 3%
            AND ∄ scenario regressed with p < 0.05 ∧ Δ ≥ 5%
REJECT  otherwise
```

The effect-atom harness implements this exactly in `bench/compare.ts`:

```typescript
const improved = significant && deltaPercent <= -3   // faster = negative delta
const regressed = significant && deltaPercent >= 5

if (anyImprovement && !anyRegression) {
  console.log("VERDICT: KEEP")
  process.exit(0)
} else if (anyRegression) {
  console.log("VERDICT: REJECT")
  process.exit(2)
} else {
  console.log("VERDICT: REJECT — no statistically significant improvement")
  process.exit(2)
}
```

### Multiple-comparison caveat

With 15+ scenarios, noise alone produces some false-positive p < 0.05 results
(Bonferroni: with 15 independent tests at p = 0.05, expected 0.75 false
positives). Options:

- Bonferroni correction: use p < 0.05 / N as threshold
- Require improvement on multiple scenarios, not just one
- Weight by scenario importance (hot paths matter more than cold paths)
- Treat the rule as a gate, not an oracle; use engineering judgment for borderline cases

A rule that rejects any candidate with a single p < 0.05 regression is too strict
when you have many scenarios: noise alone will occasionally produce a regression
on an unrelated scenario, causing you to discard real wins. The 5% regression
threshold (not 0%) accounts for this.

---

## Worked Example

Full scenario following the effect-atom harness pattern:

```typescript
// bench/scenarios/10-reactive-fibonacci.ts
import * as Atom from "@effect-atom/atom/Atom"
import * as Registry from "@effect-atom/atom/Registry"
import { benchmark, blackhole } from "../harness.js"
import type { BenchScenarioResult } from "../harness.js"

const N = 71
const EXPECTED_FIB_70 = 190392490709135
const ITERS = 10

// Atom definitions are pure — construct at module load, not in setup/run
const fibs: Array<Atom.Atom<number>> = []
fibs.push(Atom.make(0))
fibs.push(Atom.make(1))
for (let n = 2; n < N; n++) {
  const prev1 = fibs[n - 1]!
  const prev2 = fibs[n - 2]!
  fibs.push(Atom.readable((get) => get(prev1) + get(prev2)))
}

const fib70 = fibs[N - 1]!

export async function run(): Promise<BenchScenarioResult> {
  let assertionDone = false

  return benchmark({
    name: "10-reactive-fibonacci",
    description: `Reactive Fibonacci chain: N=${N}, fresh registry per run (${ITERS}/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),   // construction outside timed region
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const r = Registry.make()
        const result = r.get(fib70)

        if (!assertionDone) {
          if (result !== EXPECTED_FIB_70) {
            throw new Error(`fib(70) expected ${EXPECTED_FIB_70}, got ${result}`)
          }
          assertionDone = true
        }

        blackhole(result)
      }
    }
  })
}
```

The `benchmark()` function in `harness.ts` handles: GC before each run, heap
capture before/after, timeout guard, warmup discard, and stats computation.

### JSON output schema

```typescript
{
  env: {
    bun: string,          // Bun.version
    node: string,         // process.version
    os: string,           // "Darwin 25.0.0"
    arch: string,         // "arm64"
    cpu: string,          // CPU model
    memoryGB: number,
    gitSha: string,       // short SHA
    gitDirty: boolean,
    timestamp: string     // ISO 8601
  },
  scenarios: Array<{
    name: string,
    description: string,
    iterationsPerRun: number,
    runs: number,
    samples: Array<number>,  // raw ns per run; required for t-test
    stats: {
      min: number,    // ns per run
      max: number,
      mean: number,
      median: number,
      p95: number,
      p99: number,
      stddev: number,
      rsd: number,    // percent
      opsPerSec: number
    },
    heap: {
      heapDeltaMean: number,       // bytes
      objectCountDeltaMean: number
    }
  }>
}
```

---

## Anti-patterns

### Skipping warmup

❌
```typescript
// Run 30 times starting immediately
for (let i = 0; i < 30; i++) {
  const t0 = Bun.nanoseconds()
  doWork()
  samples.push(Bun.nanoseconds() - t0)
}
```
First 5+ samples are measuring LLInt/Baseline. Mean will be inflated.

✅ Discard `WARMUP` runs before collecting samples.

---

### Not blackholing results

❌
```typescript
run: (state) => {
  for (let i = 0; i < ITERS; i++) {
    state.registry.get(state.atom)  // result discarded
  }
}
```
DFG/FTL may eliminate the entire loop. You measure near-zero and conclude the
code is impossibly fast.

✅
```typescript
run: (state) => {
  for (let i = 0; i < ITERS; i++) {
    blackhole(state.registry.get(state.atom))
  }
}
```

---

### Using `Date.now()` or `performance.now()`

❌
```typescript
const t0 = performance.now()
doWork()
const elapsed = performance.now() - t0  // millisecond resolution
```
For sub-ms operations this gives 0 ms or 1 ms — both wrong.

✅ `Bun.nanoseconds()` exclusively.

---

### Comparing means without stddev

❌ "Implementation A averaged 48 ns vs B at 52 ns — A wins."

Without stddev, you do not know if this 4 ns difference is signal or noise.
If stddev is 8 ns, the distributions overlap entirely.

✅ Report mean ± stddev. Use Welch's t-test. Report p-value alongside delta.

---

### Rejection rule that is too strict

❌ "Reject the candidate if any scenario shows p < 0.05 regression, regardless of magnitude."

With 15 scenarios, noise alone produces ~0.75 false-positive significant results.
This rule will reject valid improvements because an unrelated scenario happened
to show a noise fluctuation.

✅ Apply a magnitude threshold (e.g. Δ ≥ 5% for regression). Tune per project.

---

### Benchmarking while using the machine

❌ Running the bench while a browser, Slack, and music player are active.

RSD will be 10-30%. Comparisons will be meaningless. The machine is not quiesced.

✅ Close all background apps. Pause music. Do not use the machine during the run.

---

## Cross-references

- `/skills js-engine-performance` — what to optimize for: hidden classes, IC
  states, JIT tier thresholds, closure vs bind memory, shape stability
- Repo CLAUDE.md `<performance-primer>` — always-loaded summary of confirmed
  engine claims
- `bun.com/docs/project/benchmarking` — Bun's own benchmarking guidance
- `bun.com/blog/debugging-memory-leaks` — JSLexicalScope retention, bind vs
  closure memory semantics
- Validation doc: `.context/explorations/2026-04-18-perf-claims-validation.md`
  — confirmed vs folklore status for all engine claims used in this codebase
