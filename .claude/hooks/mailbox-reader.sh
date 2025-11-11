#!/usr/bin/env bash

###############################################################################
# Mailbox Reader - PostToolUse Hook Wrapper
#
# This bash wrapper ensures the TypeScript implementation runs correctly with
# proper environment setup and error handling using Bun runtime.
#
# Checks the current agent's mailbox for requests from other agents and
# displays them (pull-based queue).
#
# Exit codes:
#   0 - Success (messages displayed or no messages)
#   1 - Internal error (non-fatal)
###############################################################################

set -euo pipefail

# Determine the hooks directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If CLAUDE_PROJECT_DIR is set, use it; otherwise derive from script location
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  HOOKS_DIR="${CLAUDE_PROJECT_DIR}/.claude/hooks"
else
  HOOKS_DIR="${SCRIPT_DIR}"
fi

LOG_FILE="$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"

# Read all input
INPUT=$(cat)

{
  echo ""
  echo "=============================================================================="
  echo "[ $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ") ] mailbox-reader.sh START"
  echo "------------------------------------------------------------------------------"
  echo "[INPUT PAYLOAD]"
  echo "$INPUT"
  echo "------------------------------------------------------------------------------"
  echo ""
} >> "$LOG_FILE"

# Stay in project root - Path module from Effect Platform uses cwd automatically
# DO NOT cd to HOOKS_DIR as it breaks relative path resolution

# Run the TypeScript implementation with Bun, capturing all output and exit code
READER_OUTPUT=$(echo "$INPUT" | bun run "${HOOKS_DIR}/mailbox-reader.ts" 2>&1)
READER_EXIT_CODE=$?

{
  echo ""
  echo "[TS FILE OUTPUT]"
  echo "$READER_OUTPUT"
  echo ""
  echo "[EXIT CODE: $READER_EXIT_CODE]"
  echo "[ $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ") ] mailbox-reader.sh END"
  echo "=============================================================================="
  echo ""
} >> "$LOG_FILE"

# Output messages to stdout (Claude will see them)
echo "$READER_OUTPUT"

# Always exit 0 - mailbox reading is non-critical
exit 0
