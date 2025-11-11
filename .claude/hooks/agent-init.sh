#!/bin/bash
#
# SessionStart Hook - Agent Initialization Wrapper
#
# This bash script wraps the Effect TypeScript implementation
# and is called by Claude when a new session starts.
#

set -e  # Exit on error

# Log input to file for debugging
INPUT=$(cat)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] agent-init.sh INPUT: $INPUT" >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"

# Change to hooks directory to run the TypeScript implementation
cd "$CLAUDE_PROJECT_DIR/.claude/hooks"

# Execute the TypeScript implementation using Bun, passing the captured input
# Capture both stdout and stderr to debug log
echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] agent-init.sh: Running bun agent-init.ts..." >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"
OUTPUT=$(echo "$INPUT" | bun run agent-init.ts 2>&1)
EXIT_CODE=$?
echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] agent-init.sh OUTPUT (exit $EXIT_CODE): $OUTPUT" >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"
echo "$OUTPUT"
exit $EXIT_CODE
