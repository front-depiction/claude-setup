#!/usr/bin/env bash
#
# Find Symbol - Quick symbol search with definition and references
#
# Usage:
#   find-symbol.sh SYMBOL_NAME [--max-refs=N] [--pattern=GLOB]
#
# Example:
#   find-symbol.sh scoreEntry
#   find-symbol.sh FuzzyCache --max-refs=20
#   find-symbol.sh getAll --pattern="src/**/*.ts"

set -euo pipefail

SYMBOL=""
MAX_REFS=15
FILE_PATTERN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --max-refs=*)
      MAX_REFS="${1#*=}"
      shift
      ;;
    --pattern=*)
      FILE_PATTERN="${1#*=}"
      shift
      ;;
    *)
      SYMBOL="$1"
      shift
      ;;
  esac
done

if [[ -z "$SYMBOL" ]]; then
  echo "Usage: find-symbol.sh SYMBOL_NAME [--max-refs=N] [--pattern=GLOB]"
  exit 1
fi

echo "<symbol name=\"$SYMBOL\">"
echo ""

# Build glob arguments
GLOB_ARGS=""
if [[ -n "$FILE_PATTERN" ]]; then
  GLOB_ARGS="--glob '$FILE_PATTERN'"
else
  GLOB_ARGS="--glob '*.ts' --glob '*.tsx'"
fi

# Find definition (exported declarations)
echo "<definition>"
eval rg --line-number --color=never --max-count=3 \
   \"export.*$SYMBOL\|const $SYMBOL\|function $SYMBOL\|class $SYMBOL\|interface $SYMBOL\|type $SYMBOL\" \
   $GLOB_ARGS 2>/dev/null | while IFS=: read -r file line content; do
  echo "  $file:$line"
  echo "  $content"
done || echo "  Not found"
echo "</definition>"

echo ""
echo "<references max=\"$MAX_REFS\">"

# Find references with context
eval rg --line-number --color=never --heading --context=1 \
   \"$SYMBOL\" \
   $GLOB_ARGS 2>/dev/null | head -n $((MAX_REFS * 4)) || {
  echo "  No references found"
}
echo "</references>"

echo ""
echo "</symbol>"
