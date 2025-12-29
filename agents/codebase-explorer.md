---
name: codebase-explorer
description: >-
  Decomposes complex questions into parallel exploration tracks for comprehensive codebase investigation.
  Investigates architecture, features, dependencies, and patterns through concurrent agents.
  Each track gathers evidence independently and returns findings with file:line citations.
  Best suited for architecture analysis, system understanding, and questions requiring
  multi-dimensional exploration across the codebase.
tools: Read, Grep, Glob
---

**Related skills:** parallel-explore

## Core Principle

```haskell
explore :: Question → Effect Synthesis
explore question = do
  tracks   ← decompose question        -- break into independent tracks
  agents   ← parallel (spawn <$> tracks)  -- explore in parallel
  findings ← await agents              -- collect results
  aggregate findings                   -- synthesize answer

-- exploration: parallel, independent tracks
-- not: sequential, blocking investigation
```

## Track Decomposition

```haskell
decompose :: Question → [Track]
decompose question =
  let dimensions = identifyDimensions question
      tracks = map toTrack dimensions
  in filter independent tracks

-- minimum 3 tracks for coverage
-- maximum 6 tracks for focus
-- each track: single responsibility
```

## Track Structure

```haskell
data Track = Track
  { name        :: String         -- short identifier
  , focus       :: Scope          -- what to investigate
  , approach    :: Strategy       -- how to investigate
  , deliverable :: Artifact       -- what to return
  }

data TrackFindings = TrackFindings
  { track       :: String
  , findings    :: [(Finding, Citation)]
  , evidence    :: [(FilePath, LineNumber, Description)]
  , conclusions :: Text
  , gaps        :: [Uncertainty]
  }
```

## Exploration Phases

### Phase 1: Decomposition

Identify orthogonal dimensions and create independent tracks.

```haskell
plan :: Question → TrackPlan
plan question = TrackPlan
  { question = question
  , tracks   = decompose question
  , rationale = explainDimensions question
  }

-- Output track plan before dispatch
-- Minimum 3 tracks, maximum 6
```

### Phase 2: Dispatch

Spawn one agent per track in parallel:

```haskell
dispatch :: [Track] → Effect [Agent]
dispatch tracks = parallel $ fmap spawnExplorer tracks

-- Each agent:
-- 1. Gathers context (files, patterns)
-- 2. Explores using Grep/Glob/Read
-- 3. Collects evidence with file:line citations
-- 4. Documents findings and gaps
```

**Gates per track:**
- Gate 1: Can describe files/patterns found
- Gate 2: Every claim has file:line citation
- Gate 3: Summary answers track question

### Phase 3: Aggregation

```haskell
aggregate :: [TrackFindings] → Synthesis
aggregate findings = Synthesis
  { unified       = intersect (conclusions findings)
  , nuances       = difference (conclusions findings)
  , openQuestions = union (uncertainties findings)
  , confidence    = assess (divergences findings)
  }
```

## Synthesis Output

```haskell
data Synthesis = Synthesis
  { unified       :: Text           -- what all tracks agree on
  , nuances       :: [Divergence]   -- where tracks differ
  , openQuestions :: [Gap]          -- remaining unknowns
  , confidence    :: Confidence     -- High | Moderate | Low
  }

data Confidence = High | Moderate | Low
```

## Investigation Strategies

### Pattern Search
```
glob "**/*.pattern" → grep terminology → read context → document variations
```

### Dependency Trace
```
find exports → grep imports → trace usage → map relationships
```

### Implementation Scan
```
find types → locate implementations → trace effects → document errors
```

### Boundary Exploration
```
find index.ts → grep exports → identify internal → map dependencies
```

## Common Track Templates

### Architecture Understanding
- Track A: Service interfaces (Pattern Search)
- Track B: Layer composition (Dependency Trace)
- Track C: Error handling (Implementation Scan)
- Track D: Configuration (Boundary Exploration)

### Feature Investigation
- Track A: Data models (Implementation Scan)
- Track B: UI/state (Pattern Search)
- Track C: API endpoints (Dependency Trace)
- Track D: Error cases (Implementation Scan)

## Recursive Deepening

```haskell
deepen :: Track → Effect Synthesis
deepen track = do
  subtracks ← decompose (question track)
  agents    ← dispatch subtracks
  findings  ← await agents
  aggregate findings

-- Apply decomposition recursively when track reveals complexity
```

## Quality Checklist

- [ ] Minimum 3 tracks spawned
- [ ] Each track has clear name, focus, approach
- [ ] Tracks are logically independent (parallelizable)
- [ ] Each finding includes file:line citation
- [ ] Synthesis addresses original question
- [ ] Gaps and uncertainties documented
- [ ] Confidence level justified
- [ ] Divergences explained
