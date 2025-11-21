# Example Snippets - Try These!

Test the new efficient search tools with these examples.

## 1. Basic Context Search

Find where `Option.none` is used:
```bash
.claude/scripts/context-grep.sh "Option.none" --context=2 --max-results=5
```

Find all `interface` definitions:
```bash
.claude/scripts/context-grep.sh "^interface" --context=3 --type=ts
```

Search only in src directory:
```bash
.claude/scripts/context-grep.sh "Effect.gen" --pattern="src/**/*.ts" --context=1
```

## 2. Symbol Finder

Find `scoreEntry` definition and uses:
```bash
.claude/scripts/find-symbol.sh scoreEntry
```

Find `FuzzyCache` with many references:
```bash
.claude/scripts/find-symbol.sh FuzzyCache --max-refs=20
```

Find `getAll` only in internal files:
```bash
.claude/scripts/find-symbol.sh getAll --pattern="src/internal/**/*.ts" --max-refs=8
```

## 3. Pattern-Specific Searches

Search only test files:
```bash
.claude/scripts/context-grep.sh 'describe\(' --pattern="**/*.test.ts" --context=1
```

Search only in src (exclude tests):
```bash
.claude/scripts/find-symbol.sh Option --pattern="src/**/!(*.test).ts"
```

Find exports in internal modules:
```bash
.claude/scripts/context-grep.sh "export (const|function|type)" --pattern="src/internal/*.ts" --context=2
```

## 4. Expected Output Format

**Symbol search:**
```xml
<symbol name="scoreEntry">

<definition>
  src/internal/scoring.ts:11
  export const scoreEntry = <Params extends Record<string, unknown>>(
</definition>

<references max="5">
src/internal/scoring.ts
10-
11:export const scoreEntry = <Params extends Record<string, unknown>>(
12-  entry: EntryValue.Complete<unknown>,
</references>

</symbol>
```

**Context search:**
```xml
<search pattern="Option.none" context="2" max-results="5">

<matches>
src/Matcher.ts
88-    // If beyond threshold, exclude entry entirely
89:    if (normalized > threshold) return Option.none()
90-
</matches>

</search>
```

## 5. Real-World Workflows

**Finding how something is implemented:**
```bash
# 1. Find the symbol first (shows definition + key usage)
.claude/scripts/find-symbol.sh findBestMatch --max-refs=10

# 2. If you need complete implementation, read the specific file
# (You now know: src/internal/scoring.ts)
```

**Understanding a pattern across codebase:**
```bash
# Where are Effect.gen blocks used?
.claude/scripts/context-grep.sh "Effect.gen" --context=2 --pattern="src/**/*.ts"

# How are Options handled?
.claude/scripts/context-grep.sh "Option\.(map|flatMap|filter)" --context=1
```

**Exploring test patterns:**
```bash
# Find test describes
.claude/scripts/context-grep.sh "describe\(" --pattern="**/*.test.ts" --max-results=10

# Find specific test
.claude/scripts/context-grep.sh "should.*getAll" --pattern="**/*.test.ts" --context=3
```

## Try These Now!

The HTML-like tags make the output more parseable and less visually noisy than emojis.

**Key features:**
- `--pattern=GLOB` - Filter by file glob pattern
- `--context=N` - Lines of surrounding context
- `--max-results=N` - Limit total results
- `--type=TYPE` - ripgrep file type (ts, js, md, etc.)

**Token savings: ~94% reduction** compared to Grep + Read workflow!
