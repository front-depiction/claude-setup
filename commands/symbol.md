# Find Symbol Command

Find symbol definition and all references (optimized for minimal context).

**Usage:** `/symbol SYMBOL_NAME [--max-refs=N] [--pattern=GLOB]`

**Examples:**
- `/symbol scoreEntry` - Find scoreEntry definition and references
- `/symbol FuzzyCache --max-refs=20` - Find FuzzyCache with up to 20 references
- `/symbol getAll --pattern="src/**/*.ts"` - Find getAll only in src directory

**Parameters:**
- `--max-refs=N` - Maximum number of references to show (default: 15)
- `--pattern=GLOB` - File pattern filter (e.g., "src/**/*.ts", "**/*.test.ts")

**Output format:**
```xml
<symbol name="...">
  <definition>...</definition>
  <references max="...">...</references>
</symbol>
```

---

Execute the find-symbol script:

```bash
.claude/scripts/find-symbol.sh "$@"
```
