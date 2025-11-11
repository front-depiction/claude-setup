#!/usr/bin/env bash

###############################################################################
# File Lock Enforcer - PreToolUse Hook Wrapper
#
# This bash wrapper ensures the TypeScript implementation runs correctly with
# proper environment setup and error handling using Bun runtime.
#
# Exit codes:
#   0 - Allow operation (no lock conflict)
#   1 - Internal error
#   2 - Lock denied (file locked by different agent)
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
  echo "[ $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ") ] file-lock-enforcer.sh START"
  echo "------------------------------------------------------------------------------"
  echo "[INPUT PAYLOAD]"
  echo "$INPUT"
  echo "------------------------------------------------------------------------------"
  echo ""
} >> "$LOG_FILE"

# Stay in project root - Path module from Effect Platform uses cwd automatically
# DO NOT cd to HOOKS_DIR as it breaks relative path resolution

# Run the TypeScript implementation with Bun, capturing all output and exit code
ENFORCER_OUTPUT=$(echo "$INPUT" | bun run "${HOOKS_DIR}/file-lock-enforcer.ts" 2>&1)
ENFORCER_EXIT_CODE=$?

{
  echo ""
  echo "[TS FILE OUTPUT]"
  echo "$ENFORCER_OUTPUT"
  echo ""
  echo "[ $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ") ] file-lock-enforcer.sh END"
  echo "=============================================================================="
  echo ""
} >> "$LOG_FILE"

echo "$ENFORCER_OUTPUT"

exit $ENFORCER_EXIT_CODE
