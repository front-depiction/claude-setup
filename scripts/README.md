# LSP Query Script

This directory contains the TypeScript Language Server Protocol (LSP) query script that powers the Claude Code slash commands for TypeScript code navigation and refactoring.

## Overview

The `lsp-query.ts` script provides a command-line interface to TypeScript's language services, enabling powerful code navigation and refactoring capabilities directly from Claude Code.

## Usage

```bash
bun .claude/scripts/lsp-query.ts <operation> <file> <line> <col> [newName]
```

### Operations

- **type**: Get type information at a position
- **references**: Find all references to a symbol
- **definition**: Go to the definition of a symbol
- **implementations**: Find all implementations of an interface or abstract class
- **rename**: Generate rename edits for a symbol

### Arguments

- `operation`: One of the operations listed above
- `file`: Path to the TypeScript file (relative to project root)
- `line`: Line number (1-indexed)
- `col`: Column number (1-indexed)
- `newName`: (Only for rename) The new name for the symbol

## Examples

### Get Type Information

```bash
bun .claude/scripts/lsp-query.ts type ui/lib/utils.ts 4 16
```

Output:
```json
{
  "success": true,
  "data": {
    "type": "function cn(...inputs: ClassValue[]): string",
    "documentation": "",
    "position": { "line": 4, "col": 16 },
    "textSpan": { "start": 94, "length": 8 }
  }
}
```

### Find References

```bash
bun .claude/scripts/lsp-query.ts references ui/lib/utils.ts 4 16
```

Output:
```json
{
  "success": true,
  "data": {
    "references": [
      {
        "file": "/path/to/file.ts",
        "line": 10,
        "col": 5,
        "isDefinition": false,
        "lineText": "const result = cn('class1', 'class2')"
      }
    ],
    "count": 1
  }
}
```

### Go to Definition

```bash
bun .claude/scripts/lsp-query.ts definition ui/lib/utils.ts 4 16
```

### Find Implementations

```bash
bun .claude/scripts/lsp-query.ts implementations ui/lib/services/ConsentManager.ts 10 15
```

### Generate Rename Edits

```bash
bun .claude/scripts/lsp-query.ts rename ui/lib/utils.ts 4 16 classNames
```

Output:
```json
{
  "success": true,
  "data": {
    "edits": [
      {
        "file": "/path/to/file.ts",
        "edits": [
          {
            "line": 4,
            "col": 17,
            "oldText": "cn",
            "newText": "classNames"
          }
        ]
      }
    ],
    "totalLocations": 5
  }
}
```

## Technical Details

The script uses TypeScript's Language Service API (`ts.createLanguageService`) which provides:

- Type checking and inference
- Symbol resolution
- Reference finding
- Rename refactoring
- Implementation discovery

The script reads your project's `tsconfig.json` to understand the project structure and compiler options, ensuring accurate results that match your IDE's behavior.

## Error Handling

All operations return JSON with a `success` field:

- `success: true`: Operation completed successfully, see `data` field
- `success: false`: Operation failed, see `error` field for details

Common errors:
- File not found
- No tsconfig.json found
- No type information at position
- Cannot rename (e.g., trying to rename a keyword)

## Performance

The script creates a new language service for each invocation. For multiple operations on the same codebase, consider:

- Caching the language service
- Using the TypeScript server protocol directly
- Batching operations

However, for interactive use via slash commands, the current approach provides a good balance of simplicity and performance.
