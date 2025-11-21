#!/usr/bin/env bash
#
# Context Grep - Efficient code search with minimal context
#
# Shows matches with N lines of surrounding context instead of full files.
# Dramatically reduces token usage compared to Grep + Read workflow.
#
# Usage:
#   context-grep.sh "pattern" [--context=N] [--max-results=N] [--type=TYPE] [--pattern=GLOB]
#
# Examples:
#   context-grep.sh "scoreEntry"
#   context-grep.sh "interface.*Cache" --context=5 --type=ts
#   context-grep.sh "export const" --max-results=20
#   context-grep.sh "getAll" --pattern="src/**/*.ts"

set -euo pipefail

# Default values
CONTEXT_LINES=3
MAX_RESULTS=10
FILE_TYPE=""
FILE_PATTERN=""
SEARCH_PATTERN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --context=*)
      CONTEXT_LINES="${1#*=}"
      shift
      ;;
    --max-results=*)
      MAX_RESULTS="${1#*=}"
      shift
      ;;
    --type=*)
      FILE_TYPE="${1#*=}"
      shift
      ;;
    --pattern=*)
      FILE_PATTERN="${1#*=}"
      shift
      ;;
    *)
      SEARCH_PATTERN="$1"
      shift
      ;;
  esac
done

if [[ -z "$SEARCH_PATTERN" ]]; then
  echo "Usage: context-grep.sh PATTERN [--context=N] [--max-results=N] [--type=TYPE] [--pattern=GLOB]"
  exit 1
fi

# Build rg command
RG_CMD="rg --color=never --line-number --heading"
RG_CMD="$RG_CMD --context=$CONTEXT_LINES"
RG_CMD="$RG_CMD --max-count=1" # Only show first match per file to reduce noise

if [[ -n "$FILE_TYPE" ]]; then
  RG_CMD="$RG_CMD --type=$FILE_TYPE"
fi

if [[ -n "$FILE_PATTERN" ]]; then
  RG_CMD="$RG_CMD --glob '$FILE_PATTERN'"
fi

# Execute search and format output
echo "<search pattern=\"$SEARCH_PATTERN\" context=\"$CONTEXT_LINES\" max-results=\"$MAX_RESULTS\">"
echo ""
echo "<matches>"

# Run ripgrep and limit total results
eval $RG_CMD \"$SEARCH_PATTERN\" 2>/dev/null | head -n $((MAX_RESULTS * (CONTEXT_LINES * 2 + 5))) || {
  echo "  No matches found"
}

echo "</matches>"
echo ""
echo "</search>"
