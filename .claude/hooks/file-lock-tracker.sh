#!/bin/bash
INPUT=$(cat)

LOG_FILE="$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"

{
  echo ""
  echo "=============================================================================="
  echo "[ $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ") ] file-lock-tracker.sh START"
  echo "------------------------------------------------------------------------------"
  echo "[INPUT PAYLOAD]"
  echo "$INPUT"
  echo "------------------------------------------------------------------------------"
  echo ""
} >> "$LOG_FILE"

cd "$CLAUDE_PROJECT_DIR/.claude/hooks"

TRACKER_OUTPUT=$(echo "$INPUT" | bun run file-lock-tracker.ts 2>&1)

{
  echo ""
  echo "[TS FILE OUTPUT]"
  echo "$TRACKER_OUTPUT"
  echo ""
  echo "[ $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ") ] file-lock-tracker.sh END"
  echo "=============================================================================="
  echo ""
} >> "$LOG_FILE"

echo "$TRACKER_OUTPUT"
