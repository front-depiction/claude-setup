# Context Search Command

Search for code patterns with minimal context (reduces token usage).

**Usage:** `/search PATTERN [--context=N] [--max-results=N] [--type=TYPE] [--pattern=GLOB]`

**Examples:**
- `/search scoreEntry` - Find scoreEntry with default context
- `/search "interface.*Cache" --context=5` - Find interface definitions with 5 lines context
- `/search "export const" --type=ts --max-results=20` - Find exports in TypeScript files
- `/search "Effect.gen" --pattern="src/**/*.ts"` - Search only in src directory

**Parameters:**
- `--context=N` - Number of context lines (default: 3)
- `--max-results=N` - Maximum results to show (default: 10)
- `--type=TYPE` - File type filter (ts, tsx, js, etc.)
- `--pattern=GLOB` - File pattern filter (e.g., "src/**/*.ts", "**/*.test.ts")

**Output format:**
```xml
<search pattern="..." context="..." max-results="...">
  <matches>...</matches>
</search>
```

---

Execute the context-grep script with provided arguments:

```bash
.claude/scripts/context-grep.sh "$@"
```
