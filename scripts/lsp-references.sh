#!/usr/bin/env bash
#
# LSP References - Find all references to a symbol using TypeScript LSP
#
# Usage:
#   lsp-references.sh FILE LINE COLUMN SYMBOL_NAME
#   lsp-references.sh src/internal/scoring.ts 11 14 scoreEntry
#
# Output format:
#   FILE:LINE:COL: context

set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: lsp-references.sh FILE LINE COLUMN [SYMBOL_NAME]"
  echo ""
  echo "Example: lsp-references.sh src/internal/scoring.ts 11 14 scoreEntry"
  exit 1
fi

FILE="$1"
LINE="$2"
COLUMN="$3"
SYMBOL_NAME="${4:-unknown}"

# Check if file exists
if [[ ! -f "$FILE" ]]; then
  echo "Error: File not found: $FILE"
  exit 1
fi

echo "Finding references to: $SYMBOL_NAME"
echo "Location: $FILE:$LINE:$COLUMN"
echo "---"
echo ""

# Use TypeScript compiler API to find references
# This is a simplified version - we'll use grep with context as fallback
# since full LSP integration requires a running language server

# First, try to find the symbol definition
echo "Definition:"
rg --line-number --color=never "(?:export )?(?:const|function|class|interface|type) $SYMBOL_NAME" "$FILE" 2>/dev/null || echo "  Could not find definition"

echo ""
echo "References:"

# Find all references using ripgrep with word boundaries
rg --line-number --color=never --heading --context=1 "$SYMBOL_NAME" --type-add 'ts:*.ts' --type-add 'tsx:*.tsx' --type=ts --type=tsx 2>/dev/null | head -n 100 || {
  echo "  No references found"
}
